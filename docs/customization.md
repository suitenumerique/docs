# Application Customization 🛠️

This document outlines the various ways you can customize our application to suit your specific needs without modifying the core codebase.

## Available Customization Options

1. [Translations](#custom-translations)
2. [CSS/Theme](#custom-css)

## Custom Translations

### How to Use

To provide custom translations, set the `FRONTEND_CUSTOM_TRANSLATIONS_URL` environment variable to the URL of your custom translations JSON file:

```javascript
FRONTEND_CUSTOM_TRANSLATIONS_URL=http://example.com/custom-translations.json
```

Once you've set this variable, our application will load your custom translations and apply them to the user interface.

### Benefits

- **Language control** 🌐: Customize terminology to match your organization's vocabulary.
- **Context-specific language** 📝: Adapt text for your specific use case or industry.

### Example Use Case

Let's say you want to customize some key phrases in the application. Create a JSON file with your custom translations:

```json
{
  "en": {
    "Docs": "Notes",
    "Create New Document": "+"
  },
  "de": {
    "Docs": "Notizen",
    "Create New Document": "+"
  }
}
```

Then set the `FRONTEND_CUSTOM_TRANSLATIONS_URL` environment variable to the URL of this JSON file. The application will load these translations and override the default ones where specified.

## Custom CSS

### How to Use

To customize the application's appearance, set the `FRONTEND_CSS_URL` environment variable to the URL of your custom CSS file:

```javascript
FRONTEND_CSS_URL=http://example.com/custom-style.css
```

Once you've set this variable, our application will load your custom CSS file and apply the styles to our frontend application.

### Benefits

- **Easy customization** 🔄: Customize the look and feel of our application without requiring any code changes.
- **Flexibility** 🌈: Use any CSS styles to create a custom theme that meets your needs.
- **Runtime theming** ⏱️: Change the theme of our application at runtime, without requiring a restart or recompilation.

### Example Use Case

Let's say you want to change the background color of our application to a custom color. Create a custom CSS file with the following contents:

```css
body {
  background-color: #3498db;
}
```

Then, set the `FRONTEND_CSS_URL` environment variable to the URL of your custom CSS file. Once you've done this, our application will load your custom CSS file and apply the styles, changing the background color to the custom color you specified.

