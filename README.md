<div align="center">

# ⚡ SORTNEXUS AI

### Visualize. Analyze. Understand.

An interactive, fully offline **sorting algorithm visualizer** with a Quantum Pulse cyberpunk interface.<br>
Watch 10 classic algorithms compare, swap and write in real time, race them head-to-head, and benchmark them with real metrics.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![No Frameworks](https://img.shields.io/badge/Frameworks-None-8B5CF6?style=for-the-badge)
![Offline](https://img.shields.io/badge/Runs-100%25%20Offline-22C55E?style=for-the-badge)

**[🔗 Live Demo](#-live-demo)** · **[✨ Features](#-features)** · **[🚀 Getting Started](#-getting-started)** · **[📚 Algorithms](#-algorithms)**

</div>

---

## 🎬 Live Demo

[Open SORTNEXUS AI on GitHub Pages](https://vishweshgade1225-dot.github.io/SORTNEXUS-AI/)

---

## 📖 About the Project

Sorting algorithms are usually taught with static diagrams and pseudocode, which hide the dynamic behaviour that makes each algorithm different. Students struggle to see **why** Quick Sort is usually fast but sometimes slow, why Merge Sort needs extra memory, or how Radix Sort sorts without comparing elements at all.

**SORTNEXUS AI** turns that theory into something you can see and measure. Every comparison, swap and write is animated, counted, and verified, all inside a single web page that runs without internet, a server, or any framework.

> **Note:** "SORTNEXUS AI" is the project's brand name. The application does not use machine learning. Every number it shows comes from real algorithm execution.

---

## ✨ Features

### 🎯 Sorting Arena

- Large animated bar visualization with values shown on small arrays
- **Start · Pause · Resume · Step · Reset · Shuffle** controls
- Speed slider (about 2 to 3,000 operations per second) and array size slider (5–100)
- 5 data patterns: random, nearly sorted, reverse sorted, already sorted, few unique
- Custom array input with validation
- Ascending / descending order
- Live metrics: array size, comparisons, swaps / writes, animation time, measured CPU time
- Step-by-step narration and a progress bar
- Keyboard shortcuts: `Space` start/pause · `→` step · `R` reset · `S` shuffle

| Color                     | Meaning                 |
| ------------------------- | ----------------------- |
| 🟪🟦 Pink / blue gradient | Unsorted                |
| 🟧 Amber                  | Being compared / read   |
| 🟪 Purple                 | Being swapped / written |
| ⬜ White                  | Pivot / current key     |
| 🟩 Green                  | Confirmed sorted        |

### ⚔️ Algorithm Battle

- Choose any two algorithms and race them on the **exact same array**, started on the same frame
- Independent live counters for each side
- Battle report comparing comparisons, swaps, writes, total operations and measured CPU time
- Clearly explains that animation time alone is **not** proof of computational speed

### 📊 Analytics Hub

- Benchmarks all 10 algorithms on the same input (10–1,000 elements, or the current Arena array)
- Charts for comparisons, swaps + writes, and CPU time
- Comparison table with measured counts and best / average / worst / space complexity
- Every result is checked to be correctly sorted
- Run log of completed Arena and Battle runs
- **Export to CSV**

### 📚 Learning Center

For each of the 10 algorithms: a simple explanation, how it works, a worked step-by-step example, pseudocode, best/average/worst-case and space complexity, stability, advantages, disadvantages, and real-world applications.

### ℹ️ About Project

Problem statement, objectives, technologies, system architecture, features, applications, future scope, conclusion, and an **editable team-members section** that is saved in the browser.

### 🎨 Design & Accessibility

- Neon glow, glassmorphism panels, animated gradient borders, floating particles
- Loading screen and completion animations
- Optional sound effects generated with the **Web Audio API** (muted by default, adjustable volume)
- Responsive on desktop, laptop, tablet and mobile, with no horizontal overflow
- `prefers-reduced-motion` support, keyboard navigation, ARIA labels

---

## 📚 Algorithms

| #   | Algorithm        | Best         | Average      | Worst        | Space    | Stable |
| --- | ---------------- | ------------ | ------------ | ------------ | -------- | :----: |
| 1   | Bubble Sort      | O(n)         | O(n²)        | O(n²)        | O(1)     |   ✅   |
| 2   | Selection Sort   | O(n²)        | O(n²)        | O(n²)        | O(1)     |   ❌   |
| 3   | Insertion Sort   | O(n)         | O(n²)        | O(n²)        | O(1)     |   ✅   |
| 4   | Merge Sort       | O(n log n)   | O(n log n)   | O(n log n)   | O(n)     |   ✅   |
| 5   | Quick Sort       | O(n log n)   | O(n log n)   | O(n²)        | O(log n) |   ❌   |
| 6   | Heap Sort        | O(n log n)   | O(n log n)   | O(n log n)   | O(1)     |   ❌   |
| 7   | Counting Sort    | O(n + k)     | O(n + k)     | O(n + k)     | O(n + k) |   ✅   |
| 8   | Radix Sort (LSD) | O(d·(n + b)) | O(d·(n + b)) | O(d·(n + b)) | O(n + b) |   ✅   |
| 9   | Bucket Sort      | O(n + k)     | O(n + k)     | O(n²)        | O(n + k) |   ✅   |
| 10  | Shell Sort       | O(n log n)   | ≈ O(n^1.5)   | O(n²)        | O(1)     |   ❌   |

_k = value range, d = number of digits, b = base (10)._

> **Note:** Counting Sort and Radix Sort accept only **whole numbers ≥ 0**. If the array contains decimals or negative numbers, the app explains the restriction instead of running them. Bucket Sort and all comparison sorts handle decimals and negatives.

---

## 🚀 Getting Started

No installation, no build step, no internet connection required.

### Option 1: Run locally

1. Download or clone this repository:
   ```bash
   git clone https://github.com/vishweshgade1225-dot/SORTNEXUS-AI.git
   ```
2. Open the folder and **double-click `index.html`**. It opens in Chrome or Edge from a `file:///` URL.

### Option 2: Local server (optional)

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

---

## 📁 Project Structure

```
SORTNEXUS-AI/
├── index.html   # Page structure: navigation and all five sections
├── style.css    # Quantum Pulse cyberpunk theme, animations, responsive layout
├── script.js    # Algorithms, recorder, playback engine, charts, sound, UI logic
└── README.md
```

All three files must sit in the **same folder**. They reference each other with relative paths (`./style.css`, `./script.js`).

---

## 🏗️ Architecture

```
┌──────────────────┐   ┌──────────────────┐   ┌─────────────────────┐   ┌────────────────────┐
│ Algorithm Engine │──▶│  Step Recorder   │──▶│ Playback Controller │──▶│     Renderers      │
│ 10 instrumented  │   │ counts compare/  │   │ frame-timed player  │   │ Canvas bars, live  │
│ sorting functions│   │ swap/write, logs │   │ pause/resume/step,  │   │ metrics, charts,   │
│                  │   │ steps, verifies  │   │ speed, run-ID guard │   │ Web Audio sound    │
└──────────────────┘   └──────────────────┘   └─────────────────────┘   └────────────────────┘
          │
          └──────────▶ Benchmark Runner: repeated runs without animation → average CPU time → Analytics Hub
```

- **Accurate visualization:** algorithms never touch the screen directly. They work through a recorder that both performs and logs each operation, so the animation is exactly what the algorithm did.
- **Verified output:** every run is checked for sorted order and for keeping every original value (same multiset).
- **No race conditions:** each run gets an ID. Changing the array, size or algorithm cancels the old run before a new one starts.
- **Honest metrics:** comparisons, swaps and writes are counted live. CPU time is measured with `performance.now()` over repeated runs without animation.

---

## 🌐 Deploy to GitHub Pages

1. Push the project to a GitHub repository, with `index.html` in the repository root.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. Open the deployment URL shown under **Settings → Pages** once the build succeeds.

---

## 🛠️ Troubleshooting

**The page shows plain HTML on a white background**, or a red banner says _"style.css did not load"_:

- Make sure `index.html`, `style.css` and `script.js` are in the **same folder**.
- In Windows Explorer, turn on **View → File name extensions** and check that the file isn't named `style.css.txt`.
- Filenames are case-sensitive on GitHub Pages: use `style.css`, not `Style.css`.
- Extract the ZIP before opening. Don't open `index.html` from inside the archive.
- Press `F12` → **Network**, then `Ctrl + F5`, and check that `style.css` loads with status 200.

**A banner says _"script.js did not load"_:** check that `script.js` is next to `index.html`, then press `F12` → **Console** to see the error.

---

## 🧰 Technologies Used

| Technology                | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| HTML5                     | Semantic page structure                                           |
| CSS3                      | Theme, glassmorphism, animations, responsive grid, reduced motion |
| Vanilla JavaScript (ES6+) | Algorithms, state management, UI logic                            |
| Canvas 2D API             | Bar visualizations and analytics charts                           |
| Web Audio API             | Sound effects generated in the browser                            |
| requestAnimationFrame     | Smooth, frame-timed playback                                      |
| Blob API                  | CSV export                                                        |
| localStorage              | Saving the team-members list                                      |

No React, no Node.js, no backend, no database, no API keys, no external libraries.

---

## 🔮 Future Scope

- More algorithms: Tim Sort, Intro Sort, Cocktail Shaker Sort, Comb Sort
- A code panel that highlights the active pseudocode line
- A quiz mode that asks users to predict the next step
- Recording animations as video or GIF
- Visualizers for searching and graph algorithms

---

## 👥 Team

| Name        | Role                      |
| ----------- | ------------------------- |
| _Your Name_ | Project Lead & Algorithms |
| _Member 2_  | UI / UX Design            |
| _Member 3_  | Front-end Development     |
| _Member 4_  | Testing & Documentation   |

---

<div align="center">

**⭐ If you found this project useful, consider giving it a star!**

Made with 💜 using pure HTML, CSS & JavaScript

</div>
