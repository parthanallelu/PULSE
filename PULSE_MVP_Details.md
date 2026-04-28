# PULSE — Crisis Intelligence Platform MVP

## Overview
PULSE is an offline-first crisis intelligence platform designed to transform real-time, crowd-sourced observations into structured, AI-driven insights for emergency responders. The core mission of PULSE is to ensure that critical information is never lost during connectivity blackouts by utilizing peer-to-peer relay networks and offline-first storage mechanisms.

## MVP Features

### 1. Offline-First Reporting
Citizens can create and save incident reports even with no internet connection. The application locally caches all data (including geolocations, text descriptions, and incident types) and automatically attempts synchronization when connectivity is restored.

### 2. Simulated Peer-to-Peer Data Propagation
To bridge the gap in communication blackouts, PULSE utilizes a simulated peer-to-peer data relay layer. This allows devices to act as nodes in a mesh network, passing encrypted packets of incident data between one another until one node reaches a stable internet connection.

### 3. Crisis Mode Enhancements
A lightweight, low-power interface activates dynamically. The UI removes unnecessary bloat, reduces animations, and focuses purely on actionable components to preserve battery life and ensure high performance on low-end devices.

### 4. Emergency Operations Dashboard
An AI-driven operational overview organizing chaotic human input. 
- Prioritizes critical incidents (e.g., collapses, fires) over minor ones.
- Provides a simulated map plotting matrix for spatial awareness.
- Generates recommended dispatch actions to responders, enabling faster, smarter decisions.

## Technical Architecture
- **Frontend Core**: Vanilla HTML5, CSS3, and JavaScript (ES6+). No heavy frameworks, ensuring minimal payload size for crisis-scenario downloads.
- **Styling**: Modern, custom CSS Variables implementing a strict 70:20:10 visual aesthetic ratio.
- **State Management**: DOM-based interactions and `localStorage` caching for offline capabilities.
- **Icons & Typography**: Material Icons Round and Inter font stack for high legibility in stressful environments.

## Design System
The MVP implements a clean, premium light-mode theme following a **70:20:10 ratio**:
- **70% White (Surfaces & Backgrounds)**: Clean, high-contrast surfaces (`#ffffff`, `#f8fafc`) ensure maximum readability.
- **20% Blue (Primary Action & Brand Identity)**: Trustworthy, professional blue tones (`#2563eb`) guide user attention to critical interaction points.
- **10% Accent (Alerts & Crisis Colors)**: Vibrant, semantic colors (Red `#ef4444`, Orange `#f59e0b`, Green `#10b981`) are reserved strictly for incident categorization, live telemetry status, and urgency indicators.

## Submission Details
This repository contains the hardcoded frontend prototype demonstrating the user flow and platform capabilities. It acts as the functional foundation upon which the actual decentralized mesh-networking and AI processing APIs will be integrated in subsequent phases.
