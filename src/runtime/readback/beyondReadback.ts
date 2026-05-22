import { withOscPortLock } from "../osc/oscPortLock";
import { validateTalkCommandLines } from "../talk/talkUdp";
import { nodeReadbackTransport } from "./nodeReadbackTransport";
import {
  assertExpectedOscCallback,
  expectedReadbackOscSourceHosts,
  isExpectedOscCallback,
} from "./readbackOscCallbacks";
import { validateReadbackPropertyPath } from "./readbackPropertyPath";
import { createReadbackRequestId } from "./readbackRequestId";
import { propertyReadbackScriptLines, writeVerifyScriptLines } from "./readbackScriptLines";
import {
  readbackTalkStatus,
  sendReadbackTalk,
  udpPayloadPreflightError,
  writeCommandMayHaveReachedBeyond,
} from "./readbackTalk";
import type {
  ConnectionCheckResult,
  PropertyReadbackOptions,
  PropertyReadbackResult,
  ReadbackOptions,
  ReadbackOscListener,
  ReadbackTransport,
  WriteVerifyOptions,
  WriteVerifyResult,
} from "./readbackTypes";

export async function checkBeyondConnection(
  options: ReadbackOptions,
  transport: ReadbackTransport = nodeReadbackTransport,
): Promise<ConnectionCheckResult> {
  const { logger } = options;
  const requestId = options.requestId ?? createReadbackRequestId();
  const command = `OscOutTTS "/pangolint/ping", "s", "${requestId}"`;
  const commands = [command];

  try {
    validateTalkCommandLines(commands);
    return await withOscPortLock(options, async () => {
      logger?.(`[connection] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
      const expectedSourceHosts = expectedReadbackOscSourceHosts(options);
      const listener = transport.listenForOsc(
        options.listenHost,
        options.listenPort,
        (message) =>
          isExpectedOscCallback(message, {
            address: "/pangolint/ping",
            typeTags: "s",
            expectedArgs: [requestId],
            expectedSourceHosts,
          }),
        options.timeoutMs,
      );

      listener.message.catch(() => {
        // If listener readiness fails first, this callback promise is no longer
        // awaited by checkBeyondConnection but may reject from the same socket error.
      });

      await listener.ready;
      logger?.("[connection] listener ready, sending Talk command");
      const sendResult = await sendReadbackTalk(commands, options, transport);
      if (!sendResult.ok) {
        closeReadbackOscListener(listener);
        return {
          ok: false,
          requestId,
          command,
          ...readbackTalkStatus(sendResult),
          error: sendResult.error ?? "Talk send failed.",
        };
      }
      logger?.("[connection] command sent, awaiting OSC callback");
      const message = await listener.message;
      assertExpectedOscCallback(message, {
        address: "/pangolint/ping",
        typeTags: "s",
        expectedArgs: [requestId],
        expectedSourceHosts,
      });
      logger?.(`[connection] received callback: ${message.address}`);
      return { ok: true, requestId, command, message, ...readbackTalkStatus(sendResult) };
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.(`[connection] failed: ${msg}`);
    return { ok: false, requestId, command, error: msg };
  }
}

export async function readBeyondProperty(
  options: PropertyReadbackOptions,
  transport: ReadbackTransport = nodeReadbackTransport,
): Promise<PropertyReadbackResult> {
  const { logger } = options;
  const requestId = options.requestId ?? createReadbackRequestId();
  const typeTag = options.typeTag ?? "f";
  const address = `/pangolint/readback/${requestId}`;
  const pathError = validateReadbackPropertyPath(options.propertyPath);
  if (pathError) {
    return {
      ok: false,
      requestId,
      propertyPath: options.propertyPath,
      script: "",
      error: pathError,
    };
  }

  const scriptLines = propertyReadbackScriptLines(address, typeTag, options.propertyPath, options);
  const script = scriptLines.join("\n");
  try {
    validateTalkCommandLines(scriptLines);
    const udpPayloadError = udpPayloadPreflightError(scriptLines, options);
    if (udpPayloadError) {
      return {
        ok: false,
        requestId,
        propertyPath: options.propertyPath,
        script,
        error: udpPayloadError,
      };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      requestId,
      propertyPath: options.propertyPath,
      script,
      error: msg,
    };
  }

  try {
    return await withOscPortLock(options, async () => {
      logger?.(`[readback] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
      const expectedSourceHosts = expectedReadbackOscSourceHosts(options);
      const listener = transport.listenForOsc(
        options.listenHost,
        options.listenPort,
        (message) =>
          isExpectedOscCallback(message, {
            address,
            typeTags: typeTag,
            expectedSourceHosts,
          }),
        options.timeoutMs,
      );

      listener.message.catch(() => {});

      await listener.ready;
      logger?.(`[readback] listener ready, sending property read script for ${options.propertyPath}`);
      const sendResult = await sendReadbackTalk(scriptLines, options, transport);
      if (!sendResult.ok) {
        closeReadbackOscListener(listener);
        return {
          ok: false,
          requestId,
          propertyPath: options.propertyPath,
          script,
          ...readbackTalkStatus(sendResult),
          error: sendResult.error ?? "Talk send failed.",
        };
      }
      logger?.("[readback] script sent, awaiting OSC callback");
      const message = await listener.message;
      assertExpectedOscCallback(message, {
        address,
        typeTags: typeTag,
        expectedSourceHosts,
      });
      logger?.(`[readback] received callback: ${message.address} args=${JSON.stringify(message.args)}`);
      const raw = message.args[0];
      const value = typeof raw === "string" || typeof raw === "number" ? raw : undefined;
      return {
        ok: true,
        requestId,
        propertyPath: options.propertyPath,
        script,
        value,
        message,
        ...readbackTalkStatus(sendResult),
      };
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.(`[readback] failed: ${msg}`);
    return { ok: false, requestId, propertyPath: options.propertyPath, script, error: msg };
  }
}

export async function verifyCommandWrite(
  options: WriteVerifyOptions,
  transport: ReadbackTransport = nodeReadbackTransport,
): Promise<WriteVerifyResult> {
  const { logger } = options;
  const requestId = options.requestId ?? createReadbackRequestId();
  const typeTag = options.typeTag ?? "f";
  const address = `/pangolint/verify/${requestId}`;
  const pathError = validateReadbackPropertyPath(options.readbackPath);
  if (pathError) {
    return {
      ok: false,
      command: options.command,
      readbackPath: options.readbackPath,
      expected: options.expectedValue,
      matched: false,
      restored: false,
      error: pathError,
    };
  }

  const scriptLines = writeVerifyScriptLines(options.command, address, typeTag, options.readbackPath, options);
  try {
    validateTalkCommandLines(scriptLines);
    const udpPayloadError = udpPayloadPreflightError(scriptLines, options);
    if (udpPayloadError) {
      return {
        ok: false,
        command: options.command,
        readbackPath: options.readbackPath,
        expected: options.expectedValue,
        matched: false,
        restored: false,
        error: udpPayloadError,
      };
    }
    if (options.restoreCommand) {
      validateTalkCommandLines([options.restoreCommand]);
      const restorePayloadError = udpPayloadPreflightError([options.restoreCommand], options);
      if (restorePayloadError) {
        return {
          ok: false,
          command: options.command,
          readbackPath: options.readbackPath,
          expected: options.expectedValue,
          matched: false,
          restored: false,
          error: restorePayloadError,
        };
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      command: options.command,
      readbackPath: options.readbackPath,
      expected: options.expectedValue,
      matched: false,
      restored: false,
      error: msg,
    };
  }
  let after: number | string | undefined;
  let matched = false;
  let restored = false;
  let writePacketSent = false;
  const sendRestore = async (): Promise<void> => {
    if (!options.restoreCommand) return;
    try {
      const restoreResult = await sendReadbackTalk([options.restoreCommand], options, transport);
      if (!restoreResult.ok) {
        throw new Error(restoreResult.error ?? "restore send failed");
      }
      restored = true;
      logger?.(`[verify] restore sent: ${options.restoreCommand}`);
    } catch (restoreError) {
      const msg = restoreError instanceof Error ? restoreError.message : String(restoreError);
      logger?.(`[verify] restore failed: ${msg}`);
    }
  };

  try {
    return await withOscPortLock(options, async () => {
      try {
        logger?.(`[verify] binding OSC listener on ${options.listenHost}:${options.listenPort}`);
        const expectedSourceHosts = expectedReadbackOscSourceHosts(options);
        const listener = transport.listenForOsc(
          options.listenHost,
          options.listenPort,
          (message) =>
            isExpectedOscCallback(message, {
              address,
              typeTags: typeTag,
              expectedSourceHosts,
            }),
          options.timeoutMs,
        );

        listener.message.catch(() => {});

        await listener.ready;
        logger?.(`[verify] listener ready, sending write+readback script for ${options.command}`);
        const sendResult = await sendReadbackTalk(scriptLines, options, transport);
        if (!sendResult.ok) {
          closeReadbackOscListener(listener);
          writePacketSent = writeCommandMayHaveReachedBeyond(sendResult);
          if (writePacketSent) {
            await sendRestore();
          }
          return {
            ok: false,
            command: options.command,
            readbackPath: options.readbackPath,
            expected: options.expectedValue,
            matched: false,
            restored,
            ...readbackTalkStatus(sendResult),
            error: sendResult.error ?? "Talk send failed.",
          };
        }
        writePacketSent = true;
        logger?.("[verify] script sent, awaiting OSC callback");
        const message = await listener.message;
        assertExpectedOscCallback(message, {
          address,
          typeTags: typeTag,
          expectedSourceHosts,
        });
        logger?.(`[verify] received callback: ${message.address} args=${JSON.stringify(message.args)}`);

        const raw = message.args[0];
        after = typeof raw === "string" || typeof raw === "number" ? raw : undefined;
        matched = after === options.expectedValue;

        await sendRestore();

        return {
          ok: true,
          command: options.command,
          readbackPath: options.readbackPath,
          after,
          expected: options.expectedValue,
          matched,
          restored,
          ...readbackTalkStatus(sendResult),
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger?.(`[verify] failed: ${msg}`);
        if (writePacketSent) {
          await sendRestore();
        }
        return {
          ok: false,
          command: options.command,
          readbackPath: options.readbackPath,
          expected: options.expectedValue,
          matched: false,
          restored,
          error: msg,
        };
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.(`[verify] failed: ${msg}`);
    return {
      ok: false,
      command: options.command,
      readbackPath: options.readbackPath,
      expected: options.expectedValue,
      matched: false,
      restored,
      error: msg,
    };
  }
}

function closeReadbackOscListener(listener: ReadbackOscListener): void {
  try {
    listener.close?.();
  } catch {
    // Listener cleanup is best-effort after transport failure. The original
    // Talk send result remains the actionable error for the caller.
  }
}
