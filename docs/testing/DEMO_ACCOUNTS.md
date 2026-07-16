# Cuentas demo locales

Estas cuentas existen únicamente para revisión local, capturas y pruebas E2E. El dataset se recrea de forma determinista y cada cuenta es `OWNER` de una sola organización aislada.

| Cuenta | Organización | Idioma inicial |
| --- | --- | --- |
| `empresa.angela@demo.kaklen.local` | Ángela Producciones | Español |
| `empresa.koke@demo.kaklen.local` | Koke Eventos | Español |
| `carolina.mendez@demo.kaklen.local` | Méndez Experiencias | English |
| `tomas.rivera@demo.kaklen.local` | Rivera Operaciones | Português |

Contraseña común: `KaklenDemo2026!`

```bash
pnpm db:clear:demo
pnpm db:seed:demo
pnpm db:verify:demo
```

La limpieza utiliza exclusivamente los slugs y emails demo documentados. No elimina organizaciones ni usuarios ajenos al dataset, y conserva una cuenta demo si adquirió relaciones no demo.
