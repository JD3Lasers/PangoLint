import { el } from "../dom";
import type { ReferenceOscRoute } from "../types";
import { renderCopyButton } from "./copyControls";

export function renderOscRouteList(routes: ReferenceOscRoute[]): HTMLElement {
  const list = el("ul", { className: "detail__routes-list" });
  for (const route of routes) {
    const item = el("li", { className: "detail__routes-item" });
    const header = el("div", { className: "detail__route-main" });
    header.append(el("code", { className: "detail__route-path" }, formatOscRouteSignature(route)));
    header.append(renderCopyButton(route.pathPattern, "Copy OSC route"));
    item.append(header);

    const transform = route.valueTransform ? valueTransformLabel(route.valueTransform) : null;
    if (transform) {
      item.append(el("p", { className: "detail__route-targets" }, `Transform ${transform}`));
    }

    const targets = route.normalizedTargetPropertyPatterns ?? route.targetPropertyPatterns;
    if (targets?.length) {
      item.append(el("p", { className: "detail__route-targets" }, `Targets ${targets.join(", ")}`));
    }
    list.append(item);
  }
  return list;
}

export function renderObjectRouteSummary(routes: ReferenceOscRoute[]): HTMLElement {
  const wrap = el("div", { className: "object__routes" });
  wrap.append(el("span", { className: "object__routes-label" }, "OSC routes"));
  const visibleRoutes = routes.slice(0, 4);
  for (const route of visibleRoutes) {
    const routeLine = el("span", { className: "object__route" });
    routeLine.append(el("code", {}, formatOscRouteSignature(route)));
    const transform = route.valueTransform ? valueTransformLabel(route.valueTransform) : null;
    if (transform) {
      routeLine.append(el("span", { className: "object__route-meta" }, transform));
    }
    wrap.append(routeLine);
  }
  const hiddenCount = routes.length - visibleRoutes.length;
  if (hiddenCount > 0) {
    wrap.append(el("span", { className: "object__route-more" }, `${hiddenCount} more routes`));
  }
  return wrap;
}

function formatOscRouteSignature(route: ReferenceOscRoute): string {
  const args = route.args.length ? route.args.join(", ") : "no args";
  return `${route.pathPattern} (${args})`;
}

export function valueTransformLabel(transform: NonNullable<ReferenceOscRoute["valueTransform"]>): string {
  switch (transform.kind) {
    case "arrayOffset":
      return transform.offset === undefined ? "array offset" : `array offset ${signedNumber(transform.offset)}`;
    case "directChannelIndex":
      return "direct channel index";
    case "divide":
      return transform.factor === undefined ? "divide" : `divide by ${transform.factor}`;
    case "multiply":
      return transform.factor === undefined ? "multiply" : `multiply by ${transform.factor}`;
    case "offset":
      return transform.amount === undefined ? "offset" : `offset ${signedNumber(transform.amount)}`;
    case "subtract":
      return transform.amount === undefined ? "subtract" : `subtract ${transform.amount}`;
    default:
      return transform.kind
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replaceAll("-", " ")
        .toLowerCase();
  }
}

function signedNumber(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
