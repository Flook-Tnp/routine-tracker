# 📘 Disby: Complete Operational Manual

This document provides a deep dive into the features, interface, and underlying logic of the Disby system. It is designed to help users and maintainers understand exactly how data is processed and displayed.

---

## 🏗️ Core Architecture

The system is a **Categorized Habit Tracker**. Unlike standard "to-do" lists, this app focuses on long-term consistency. Data is stored in two primary tables:
1.  **Routines**: The definitions of your habits (e.g., "Vocab", "Read").
2.  **Completions**: A timestamped log of every time a routine was finished.

---

## 🕹️ Interface Controls

### 1. The Sticky Header (Navigation & Identity)
The header is locked to the top of the screen for instant access.
- **Title & Help (?):** Clicking the title returns you to the default state. The `?` icon opens the in-app version of this manual.
- **Date Navigation:** 
    - **Arrows (`<` `>`):** Move backward or forward by exactly one day.
    - **Calendar Display:** Opens a precision date picker.
    - **TODAY Button:** Appears only when viewing a past or future date. Clicking it instantly syncs the view to the current real-world date.
- **Day Strip (7-Day Row):** Provides a "one-tap" jump to recent days. The active day is solid cyan; the real-world "Today" is marked with a small dot if not selected.

### 2. Category Management
The app uses a "Tab" system to separate different areas of your life (e.g., "Practice Language", "Investment").
- **Adding:** Click `+ NEW_SECTION` to create a globally accessible category.
- **Editing (Pencil):** Renames the category. **Crucial:** Renaming updates the category link for all existing routines, meaning you **keep your history**.
- **Deleting (Trash):** This is a "Hard Delete." It removes the category, every routine inside it, and **every single completion record** from the database forever.

### 3. Routine Management (The Protocols)
- **Completion:** Click a routine card to toggle its status. Checkmarks are saved instantly to Supabase.
- **Editing (Pencil):** Updates the name of the routine without breaking the link to past completion records.
- **Deleting (Trash):** Wipes that specific routine and its personal history.

---

## 🧮 Mathematical Logic & Statistics

The tracker uses several specific formulas to provide a fair assessment of your habits.

### 1. Daily Streak (The Flame 🔥)
- **Logic:** Counts consecutive days with **at least one** completion in the **active category**.
- **The "Safety" Rule:** If you haven't completed a task *today* yet, the streak does not break. It checks from *yesterday* backward. The streak only resets to zero if a full 24-hour cycle (yesterday) passes with zero activity.
- **Limit:** Supported up to 1,000,000 days.

### 2. Weekly Streak (The Trophy 🏆)
- **Logic:** Designed as a "Motivation Safety Net." 
- **Success Criteria:** A week (Sunday to Saturday) is successful if you were active on **at least 3 different days** that week.
- **Purpose:** This allows you to lose your Daily Streak (e.g., due to a 2-day illness) without losing your Weekly Trophy, encouraging you to jump back in immediately.

### 3. 30-Day Performance (Context-Aware)
These stats look at a **rolling 30-day window** ending on your **selected date**.
- **Perfect Days:** The number of days in that window where you achieved **100% completion** of all routines in the category.
- **Avg Efficiency:** `(Total Completions in Window) / (Total Possible Opportunities in Window)`. 
    - *Example:* 5 routines × 30 days = 150 possible. If you did 75, efficiency is 50%.

### 4. Task Breakdown (Individual Accuracy)
Each routine has its own "Efficiency Card."
- **Start Date:** The date of the **first-ever completion recorded** for that specific routine.
- **Active Days:** Total days elapsed from the Start Date until today.
- **Formula:** `(Total Routine Completions) / (Active Days)`.
- **Fairness:** If you add a new routine today, it starts at 100% (if done) or 0% (if not), rather than being penalized for the years of history before it existed.

### 5. Lifetime Performance Chart
- **X-Axis:** Automatically zooms to fit the timeline of the **currently visible** routines.
- **Lines:** 
    - **Total Average (Cyan):** The daily average of all active routines.
    - **Task Lines (Colored):** Individual performance over time.
- **Interaction:** 
    - **Toggles:** Click names in the legend to hide/show lines.
    - **Brush:** Use the scrollbar at the bottom to zoom into specific eras of your history.
    - **Fullscreen:** Expand the chart for high-resolution data analysis.

---

## 🛡️ Data Integrity
- **Persistence:** All data is synced to Supabase.
- **Leap Years:** The logic fully accounts for February 29th.
- **Timezones:** The app uses local system time for "Today" but stores dates in ISO format (`YYYY-MM-DD`) to ensure consistency across the globe.
