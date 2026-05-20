# Peekr — Branded i18n Email Templates

Templates HTML para Supabase Auth — un solo template por flow que se ramifica
según `{{ .Data.language }}` (que viene de `auth.users.raw_user_meta_data.language`).

## Cómo aplicar

1. Entrá a Supabase Dashboard → tu proyecto → **Authentication → Email Templates**.
2. Para cada uno de los flows abajo:
   - **Subject heading**: pegar el contenido del archivo `*.subject.txt`.
   - **Message body (HTML)**: pegar el contenido del archivo `*.html`.
3. Guardá.

> Los templates usan **Go template conditionals** (`{{ if eq .Data.language "pt" }}…{{ else if eq .Data.language "en" }}…{{ else }}…{{ end }}`) que Supabase soporta nativamente. No requieren edge function ni SMTP custom.

## Flows cubiertos

| Flow | Archivos | Disparado por |
|---|---|---|
| Confirm signup | `confirm-signup.subject.txt`, `confirm-signup.html` | Email/password sign-up cuando `Enable email confirmations` está ON |
| Password reset | `reset-password.subject.txt`, `reset-password.html` | `supabase.auth.resetPasswordForEmail()` |
| Magic link | `magic-link.subject.txt`, `magic-link.html` | Magic link sign-in (no usado hoy pero queda armado) |
| Change email | `change-email.subject.txt`, `change-email.html` | Cuando el user cambia su email |
| Reauthentication / Password changed notice | `reauthentication.subject.txt`, `reauthentication.html` | Notificación informativa cuando se cambia la contraseña (sin CTA — solo aviso) |

## Si en el Dashboard NO ves un slot "Reauthentication"

Algunos proyectos de Supabase no exponen ese template como editable. En ese caso el email "Your password has been set" lo manda Supabase Auth como **security notification automática** y NO es brandeable vía template.

Las dos opciones para ese caso:

1. **Send Email Hook (Auth Hook)**: configurar una edge function en `Authentication → Hooks` que intercepta TODO el envío de emails y renderea HTML custom. Es lo más potente pero requiere SMTP custom (Resend / SendGrid).

2. **Custom SMTP**: en `Authentication → SMTP Settings`, configurar un proveedor propio. Eso permite controlar el subject/from y abre la puerta a templates más ricos vía X-Headers.

Por ahora, si Supabase manda el "password changed" sin que vos puedas editarlo, queda como el único email no-branded de la suite. Aceptable como trade-off.

## Brand

- Color magenta: `#FA0082`
- Background dark: `#0F1014`
- Tipografía: stack del sistema (Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial)

## Variables Supabase disponibles

Cada flow expone diferentes vars. Las más usadas:

- `{{ .ConfirmationURL }}` — URL completa para confirmar/resetear (incluye el token)
- `{{ .Token }}` — el token (si quisieras armar la URL vos)
- `{{ .Data.language }}` — viene de `raw_user_meta_data.language`
- `{{ .Email }}` — email del destinatario
- `{{ .RedirectTo }}` — URL configurada en `redirectTo` del call SDK

## Backfill ya aplicado

927 users que no tenían `language` en metadata ya fueron backfileados desde `public.profiles.language` el 2026-05-20.

Para nuevos signups, tanto el app móvil como el form `/signup` del web pasan
`language` en `options.data`, así que la metadata queda seteada al firmar.
