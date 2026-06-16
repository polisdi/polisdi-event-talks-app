# BigQuery Release Notes Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.12%2B-blue)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1%2B-lightgrey)](https://flask.palletsprojects.com/)

A sleek, responsive web application built with **Python Flask** and **vanilla HTML/CSS/JavaScript** that:

- **Fetches** the official Google Cloud **BigQuery release notes** from the public Atom feed.
- **Parses** each entry into discrete update cards (features, issues, deprecations, etc.).
- **Filters** and **searches** updates dynamically on the client side.
- Provides a **refresh button** with a loading spinner.
- Lets you **select any update** and quickly **craft a tweet** (X) with optional date, type, link, and hashtags.
- Includes a **modern glass‑morphic UI**, animated background blobs, skeleton loaders, toast notifications, and a polished modal for tweet customization.

---

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [Usage Guide](#usage-guide)
- [Contributing](#contributing)
- [License](#license)

---

## Demo

You can view a live demo (if hosted) at: `http://localhost:5000` after running the app locally.

---

## Features

- **Live feed** – Pulls the latest release notes from `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
- **Client‑side filtering** – Filter by update type (Feature, Issue, Deprecation, Other) via pill buttons.
- **Full‑text search** – Instant keyword search across all updates.
- **Refresh with spinner** – One‑click refresh; UI shows a loading indicator.
- **Tweet composer** – Select any update, open a modal, customize tweet content, copy to clipboard, or open the X/Twitter intent URL.
- **Elegant UI** – Dark theme, glass‑morphic cards, animated gradient blobs, custom scrollbars, and responsive layout.
- **Caching** – Server caches feed data for 1 hour (in‑memory and JSON file) to reduce network calls.
- **Zero external JS frameworks** – Pure vanilla JavaScript for maximum control.
- **Copy to Clipboard** – Quickly copy a release note’s text to the clipboard.
- **Export to CSV** – Export the currently visible notes as a CSV file.


---

## Installation

1. **Clone the repository** (replace `<YOUR_USERNAME>` with your GitHub username):
   ```bash
   git clone https://github.com/<YOUR_USERNAME>/<YOUR_USERNAME>-event-talks-app.git
   cd <YOUR_USERNAME>-event-talks-app
   ```

2. **Create a Python virtual environment** and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate   # on Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
   *If `requirements.txt` is not present, you can install directly:*
   ```bash
   pip install flask requests beautifulsoup4
   ```

3. **(Optional) Set up a `.env` file** for custom configuration (e.g., change cache duration).

---

## Running the App

```bash
# Ensure the virtual environment is active
source venv/bin/activate
python app.py
```

The development server starts on **http://127.0.0.1:5000**. Open this address in a browser.

- Click **Refresh** to pull the latest notes.
- Use the **search bar** or **type pills** to filter.
- Click **Share on X** on any card to open the tweet modal.

---

## Project Structure

```
├── app.py                     # Flask server + API endpoints
├── requirements.txt           # Python dependencies (optional)
├── notes_cache.json           # Auto‑generated cache file (ignored by .gitignore)
├── static/
│   ├── css/
│   │   └── style.css          # Custom styling, glass‑morphism, animations
│   └── js/
│       └── app.js            # Front‑end logic (fetch, filter, tweet modal)
├── templates/
│   └── index.html            # Main HTML page
├── .gitignore                # Ignored files (virtualenv, caches, etc.)
├── README.md                 # **You are reading it!**
└── project_overview.md       # Architecture & API documentation
```

---

## Usage Guide

1. **Load the page** – The app automatically fetches the latest release notes.
2. **Filter** – Click a pill (All, Feature, Issue, Deprecation, Other) to narrow the view.
3. **Search** – Type any keyword; results update instantly.
4. **Refresh** – Hit the **Refresh** button; a spinner shows while re‑fetching.
5. **Tweet** – Press **Share on X** on a card → modal opens → toggle options (date, type, link, hashtags) → copy or click **Tweet this Update** which opens Twitter’s intent page.
6. **Copy** – The **Copy Text** button copies the prepared tweet to the clipboard.

---

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b my-feature
   ```
3. Commit your changes and push to your fork.
4. Open a pull request against the `main` branch.

Please ensure your code follows the existing style and includes relevant tests if applicable.

---

## License

This project is licensed under the **MIT License** – see the `LICENSE` file for details.
