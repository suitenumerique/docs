# Language Configuration (2025-12)

This document explains how to configure and override the available languages in the Docs application.

## Default Languages

By default, the application supports the following languages (in priority order):

- English (en-us)
- French (fr-fr)
- German (de-de)
- Dutch (nl-nl)
- Spanish (es-es)

The default configuration is defined in `src/backend/impress/settings.py`:

```python
LANGUAGES = values.SingleNestedTupleValue(
    (
        ("en-us", "English"),
        ("fr-fr", "Français"),
        ("de-de", "Deutsch"),
        ("nl-nl", "Nederlands"),
        ("es-es", "Español"),
    )
)
```

## Overriding Languages

### Using Environment Variables

You can override the available languages by setting the `DJANGO_LANGUAGES` environment variable. This is the recommended approach for customizing language support without modifying the source code.

#### Format

The `DJANGO_LANGUAGES` variable expects a semicolon-separated list of language configurations, where each language is defined as `code,Display Name`:

```
DJANGO_LANGUAGES=code1,Name1;code2,Name2;code3,Name3
```

#### Example Configurations

**Example 1: English and French only**

```bash
DJANGO_LANGUAGES=en-us,English;fr-fr,Français
```

**Example 2: Add Italian and Chinese**

```bash
DJANGO_LANGUAGES=en-us,English;fr-fr,Français;de-de,Deutsch;it-it,Italiano;zh-cn,中文
```

**Example 3: Custom subset of languages**

```bash
DJANGO_LANGUAGES=fr-fr,Français;de-de,Deutsch;es-es,Español
```

### Configuration Files

#### Development Environment

For local development, you can set the `DJANGO_LANGUAGES` variable in your environment configuration file:

**File:** `env.d/development/common.local`

```bash
DJANGO_LANGUAGES=en-us,English;fr-fr,Français;de-de,Deutsch;it-it,Italiano;zh-cn,中文;
```

#### Production Environment

For production deployments, add the variable to your production environment configuration:

**File:** `env.d/production.dist/common`

```bash
DJANGO_LANGUAGES=en-us,English;fr-fr,Français
```

#### Docker Compose

When using Docker Compose, you can set the environment variable in your `compose.yml` or `compose.override.yml` file:

```yaml
services:
  app:
    environment:
      - DJANGO_LANGUAGES=en-us,English;fr-fr,Français;de-de,Deutsch
```

## Important Considerations

### Language Codes

- Use standard language codes (ISO 639-1 with optional region codes)
- Format: `language-region` (e.g., `en-us`, `fr-fr`, `de-de`)
- Use lowercase for language codes and region identifiers

### Priority Order

Languages are listed in priority order. The first language in the list is used as the fallback language throughout the application when a specific translation is not available.

### Translation Availability

Before adding a new language, ensure that:

1. Translation files exist for that language in the `src/backend/locale/` directory
2. The frontend application has corresponding translation files
3. All required messages have been translated

#### Available Languages

The following languages have translation files available in `src/backend/locale/`:

- `br_FR` - Breton (France)
- `cn_CN` - Chinese (China) - *Note: Use `zh-cn` in DJANGO_LANGUAGES*
- `de_DE` - German (Germany) - Use `de-de`
- `en_US` - English (United States) - Use `en-us`
- `es_ES` - Spanish (Spain) - Use `es-es`
- `fr_FR` - French (France) - Use `fr-fr`
- `it_IT` - Italian (Italy) - Use `it-it`
- `nl_NL` - Dutch (Netherlands) - Use `nl-nl`
- `pt_PT` - Portuguese (Portugal) - Use `pt-pt`
- `ru_RU` - Russian (Russia) - Use `ru-ru`
- `sl_SI` - Slovenian (Slovenia) - Use `sl-si`
- `sv_SE` - Swedish (Sweden) - Use `sv-se`
- `tr_TR` - Turkish (Turkey) - Use `tr-tr`
- `uk_UA` - Ukrainian (Ukraine) - Use `uk-ua`
- `zh_CN` - Chinese (China) - Use `zh-cn`

**Note:** When configuring `DJANGO_LANGUAGES`, use lowercase with hyphens (e.g., `pt-pt`, `ru-ru`) rather than the directory name format.

### Translation Management

We use [Crowdin](https://crowdin.com/) to manage translations for the Docs application. Crowdin allows our community to contribute translations and helps maintain consistency across all supported languages.

**Want to add a new language or improve existing translations?**

If you would like us to support a new language or want to contribute to translations, please get in touch with the project maintainers. We can add new languages to our Crowdin project and coordinate translation efforts with the community.

### Cookie and Session

The application stores the user's language preference in a cookie named `docs_language`. The cookie path is set to `/` by default.

## Testing Language Configuration

After changing the language configuration:

1. Restart the application services
2. Verify the language selector displays the correct languages
3. Test switching between different languages
4. Confirm that content is displayed in the selected language

## Troubleshooting

### Languages not appearing

- Verify the environment variable is correctly formatted (semicolon-separated, comma between code and name)
- Check that there are no trailing spaces in language codes or names
- Ensure the application was restarted after changing the configuration

### Missing translations

If you add a new language but see untranslated text:

1. Check if translation files exist in `src/backend/locale/<language_code>/LC_MESSAGES/`
2. Run Django's `makemessages` and `compilemessages` commands to generate/update translations
3. Verify frontend translation files are available

## Related Configuration

- `LANGUAGE_CODE`: Default language code (default: `en-us`)
- `LANGUAGE_COOKIE_NAME`: Cookie name for storing user language preference (default: `docs_language`)
- `LANGUAGE_COOKIE_PATH`: Cookie path (default: `/`)

