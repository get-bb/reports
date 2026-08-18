export default async function plugin(bb: any) {
  bb.settings.define({
    alertFloorMinutes: { type: "string", label: "Alert floor (min)", default: "60" },
    staleWindowMinutes: { type: "string", label: "Stale window (min)", default: "1440" },
    token: { type: "string", label: "Token", secret: true },
  });
}
