# EAS Project Setup

The `extra.eas.projectId` in `app.json` is currently set to a placeholder value:

```
"projectId": "werkr-placeholder-replace-with-real-eas-id"
```

## To get the real project ID:

1. Create an EAS account at https://expo.dev
2. Run: `npx eas-cli login`
3. Run: `npx eas-cli init` in the project root — this will set the real projectId in `app.json`
4. Or create the project in the Expo dashboard and copy the UUID from project settings.

The placeholder **must** be replaced before any EAS Build or EAS Submit submission.
