# GeoFlare — Frontend Project Summary

**Last updated:** 18 October 2026  
**Role scope:** Frontend only. Keep the interface functional and organized, but do not add mock data or integrate backend APIs yet.

## 1. Project Goal

GeoFlare is a frontend for exploring fire activity detected by NASA's MODIS and VIIRS satellite instruments.

- **MODIS:** approximately 1 km resolution; observations available from 2000.
- **VIIRS:** approximately 375 m resolution; observations available from 2012.

Hotspot counts from the two instruments cannot be compared as if they were equivalent. VIIRS can detect smaller or more localized fires that MODIS may miss. The interface should communicate this limitation and help users distinguish changes in observed hotspot counts from differences caused by the observing systems.

The intended product presents information through an interactive map, a burning-activity calendar, charts, anomaly/alert views, and downloadable reports.

## 2. Frontend Scope and Constraints

- Build the frontend only for the current stage.
- Do **not** create mock/sample datasets to make the screens look populated.
- Do **not** integrate backend APIs yet.
- Keep components reusable and pages separate.
- Keep authentication UI separate from the rest of the application so user information can be reused later.
- Avoid an overwhelming, overly card-heavy interface.
- Use a restrained orange-and-black visual direction for the authentication experience.
- Use `camelCase` for JavaScript/React names.
- The current frontend is React + Vite + Tailwind. Existing globe work has involved TSX/TypeScript; confirm the actual project configuration before changing languages or adding dependencies.

## 3. Work Completed So Far

- [x] Set up the frontend project using Vite and React.
- [x] Set up Tailwind CSS.
- [x] Created a modular `src` folder structure for reusable components, pages, contexts, hooks, services, types, utilities, constants, styles, and data.
- [x] Started the landing page.
- [x] Added the interactive globe/map visual to the landing page.
- [x] Iterated on the globe layout and appearance; the globe/map is now considered ready for the next stage.

> This checklist reflects progress recorded in the project conversation. It does not certify that every route, responsive breakpoint, or build check has been tested.

## 4. Remaining Tasks

### A. Authentication UI — next task

- [ ] Build the login/sign-up page.
- [ ] Use a simple orange-and-black theme with restrained neumorphic styling.
- [ ] Keep the rotating globe on the left.
- [ ] Make the sign-in/sign-up panel slide in from the right when the user switches modes.
- [ ] Add the required form fields, labels, validation states, and show/hide password control as UI behavior only.
- [ ] Keep authentication components separate and reusable.
- [ ] Do not implement real authentication or connect an API yet.

### B. Application Shell and Navigation

- [ ] Create the shared layout for authenticated/application pages.
- [ ] Add reusable navigation and page structure.
- [ ] Keep each major feature on its own page to reduce visual clutter.
- [ ] Add route handling for the landing page, authentication pages, and feature pages.

### C. Burning Activity Calendar

- [ ] Create the calendar page layout.
- [ ] Provide daily, weekly, and seasonal views for a selected region.
- [ ] Include clear empty states because no real data/API is connected yet.
- [ ] Make the sensor distinction visible wherever it affects interpretation.

### D. Analytics and Trends

- [ ] Create the trends/analytics page layout.
- [ ] Reserve clear chart areas for historical patterns and baselines.
- [ ] Include explanatory UI that hotspot counts from MODIS and VIIRS are not directly equivalent.
- [ ] Do not fabricate chart values or historical baselines.

### E. Anomalies and Alerts

- [ ] Create the anomaly page layout.
- [ ] Design alert/anomaly states and explanatory text without inventing actual detections.
- [ ] Distinguish interface placeholders/empty states from real findings.

### F. Reports and Export UI

- [ ] Create the report/export page or reusable export panel.
- [ ] Design report options and download states.
- [ ] Do not claim a report was generated until real data and export logic exist.

### G. Final Frontend Quality Pass

- [ ] Check routing and navigation.
- [ ] Check desktop and mobile responsiveness.
- [ ] Check loading, empty, validation, and error states where applicable.
- [ ] Check keyboard accessibility, form labels, and visible focus states.
- [ ] Remove unused code and resolve console/build errors.
- [ ] Verify that no mock data or backend integration has been introduced.

## 5. Suggested Page Structure

1. **Landing page** — project introduction and interactive globe/map.
2. **Login / Sign up** — reusable authentication UI.
3. **Dashboard or overview** — entry point to the main features.
4. **Activity calendar** — daily, weekly, and seasonal activity interface.
5. **Trends and analytics** — charts and historical-baseline interface.
6. **Anomalies and alerts** — unusual-activity interface.
7. **Reports and exports** — report configuration and download interface.

## 6. Important Scientific UX Rule

Never imply that a rise in hotspot counts automatically means fire activity increased. Differences may result from the instruments' different spatial resolutions and observing characteristics. The UI must preserve the sensor identity and explain the limits of direct comparison.

## 7. Current Boundary

For this frontend stage, feature pages should be built with real UI structure and honest empty states only. Data fetching, backend endpoints, authentication services, and real report generation are out of scope until explicitly started.
