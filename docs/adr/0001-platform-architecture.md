# ADR-0001: One Codebase — Mobile App + Website

**Status:** Accepted  
**Date:** 2026-06-11  
**Deciders:** WERKR Engineering

## Context
WERKR needs to serve mobile users (iOS/Android) AND web users who are not smartphone-affine (older Handwerker, business customers booking via desktop).

## Decision
Single codebase via **React Native + Expo Router**. Web output via `expo-router` with `react-native-web`. Separate landing page at `/landing` for desktop visitors.

## Consequences
- One TypeScript codebase ships to App Store, Play Store, and as a website
- No duplicate logic
- Trade-off: Some web-specific UI patterns require Platform.OS checks
- Web SEO is limited vs. pure Next.js — acceptable for MVP phase
