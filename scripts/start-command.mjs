export const START_MODES = Object.freeze({
  default: "dev:fresh",
  i18n: "dev:i18n",
  full: "dev:full:i18n"
});

export function parseStartArguments(input) {
  const args = input.filter((argument) => argument !== "--");
  if (args.length === 0) {
    return runResult("default");
  }
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    return { kind: "help" };
  }

  let mode = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    let value = null;
    if (argument === "--mode") {
      value = args[index + 1] ?? "";
      index += 1;
    } else if (argument.startsWith("--mode=")) {
      value = argument.slice("--mode=".length);
    } else {
      return errorResult(`Opción desconocida: ${argument}`);
    }
    if (mode !== null) {
      return errorResult("El modo solo puede indicarse una vez.");
    }
    mode = value;
  }

  if (!mode || !Object.hasOwn(START_MODES, mode) || mode === "default") {
    return errorResult(`Modo inválido: ${mode || "(vacío)"}`);
  }
  return runResult(mode);
}

export function startHelp() {
  return [
    "Uso: pnpm start [--mode=i18n|--mode=full]",
    "",
    "Modos:",
    "  sin flags     Desarrollo limpio con API y web base (dev:fresh)",
    "  --mode=i18n   Frontend localizado es, en y pt-BR (dev:i18n)",
    "  --mode=full   API y frontend localizado completos (dev:full:i18n)",
    "  --help        Mostrar esta ayuda"
  ].join("\n");
}

function runResult(mode) {
  return { kind: "run", mode, script: START_MODES[mode] };
}

function errorResult(message) {
  return { kind: "error", message };
}
