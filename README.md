# FEEL Mobile

FEEL Mobile is a React Native Expo application for reporting injured or stray animals, browsing rescue activity, submitting adoption and rehome listings, and supporting volunteer rescue workflows. The app uses Firebase Authentication for sign-in, Cloudinary for image uploads, and a Railway-hosted backend for its core data and rescue operations.

## Project Overview

FEEL Mobile is designed to connect people who find animals in distress with the services and volunteers that can help. Users can browse public rescue and adoption listings, sign in with Firebase Authentication, report animals with photos and location details, and follow the status of rescue activity through the app.

The app also supports volunteer-specific workflows such as claiming rescues, updating progress, and viewing assigned cases. Images are uploaded directly to Cloudinary, while user, report, adoption, and volunteer data is exchanged with the backend API hosted on Railway.

## Features

- Report injured or stray animals with photos, severity, notes, and location details.
- Upload report and adoption images to Cloudinary.
- Browse public rescue reports and adoption listings.
- Filter rescue reports by status and distance.
- Sign in and manage accounts with Firebase Authentication.
- Track your submitted reports and their status updates.
- Apply to become a volunteer and manage volunteer-related rescue work.
- Claim rescues, update rescue progress, and cancel claims when needed.
- Create and browse rehome and adoption listings.
- View profile information and rescue activity history.

## Tech Stack

- React Native
- Expo SDK 54
- React Navigation
- Firebase Authentication
- Cloudinary for media uploads
- Railway-hosted backend API
- `expo-image-picker`
- `expo-location`
- `expo-notifications`
- `react-hook-form`

## Installation

### Prerequisites

- Node.js and npm
- An Expo-compatible development environment
- A Firebase project configured for authentication
- A Cloudinary account with an upload preset
- Access to the FEEL backend API

### Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create a local environment file based on [`.env.example`](.env.example).
4. Start the app:

```bash
npm start
```

You can also run platform-specific targets with:

```bash
npm run android
npm run ios
npm run web
```

## Environment Variables

Create a local `.env` file in the project root with the values below.

| Variable | Description |
| --- | --- |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name used for image uploads. |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary upload preset used by the app. |
| `EXPO_PUBLIC_CLOUDINARY_FOLDER` | Optional Cloudinary folder for uploaded assets. Defaults to `feel-reports` for reports and `feel-adoptions` for rehome listings when not overridden in code. |
| `EXPO_PUBLIC_API_URL` | Base URL of the FEEL backend API. Defaults to the Railway production endpoint if not set. |

The repository includes [`.env.example`](.env.example) as a reference.

## Folder Structure

```text
.
├── App.js
├── apiClient.js
├── firebase.js
├── theme.js
├── assets/
├── components/
│   ├── ActionButton.js
│   ├── ReportImageGallery.js
│   ├── RescueCard.js
│   ├── RescueDetailsModal.js
│   └── ui/
├── navigation/
├── screens/
│   ├── AdoptScreen.js
│   ├── ClaimedRescuesScreen.js
│   ├── CompleteProfileScreen.js
│   ├── DonationsScreen.js
│   ├── HomeScreen.js
│   ├── LoginScreen.js
│   ├── LogoutScreen.js
│   ├── MyReportsScreen.js
│   ├── ProfileScreen.js
│   ├── RehomeScreen.js
│   ├── RescueFeedScreen.js
│   ├── SignupScreen.js
│   └── VolunteerApplicationScreen.js
└── utils/
```

## Future Improvements

- Add automated tests for reporting, volunteering, and listing flows.
- Introduce stronger input validation and user-facing error recovery.
- Expand rescue filtering and search options.
- Add offline-friendly behavior for spotty network conditions.
- Move more app configuration into environment variables where appropriate.

## Contributing

Contributions are welcome. If you plan to change the app:

1. Create a feature branch.
2. Make your changes with clear, focused commits.
3. Test the app locally before opening a pull request.
4. Include context in the PR description for any backend, API, or environment changes.

Please keep contributions aligned with the existing product scope and avoid introducing unsupported flows.

## License

This project is currently unlicensed. Add a license file before publishing the repository publicly.
