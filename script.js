/* =====================================================================
   SORTNEXUS AI — Sorting Algorithm Visualizer
   Pure vanilla JavaScript. Works offline from a file:/// URL.

   Architecture
   ------------
   1. Algorithm Engine  : 10 sorting functions that operate on a Recorder.
   2. Recorder          : performs + counts compare/swap/write operations and,
                          when recording, logs them as animation steps.
   3. Player            : replays a step log on a canvas with pause/resume/
                          step/speed control and run-ID guards.
   4. UI controllers    : Arena, Battle, Analytics, Learning Center, About.
   ===================================================================== */
'use strict';

(function () {

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const fmtMs = (ms) => (ms < 0.01 ? ms.toFixed(4) : ms < 1 ? ms.toFixed(3) : ms < 100 ? ms.toFixed(2) : ms.toFixed(0));
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const COLORS = {
    pink: '#EC4899', purple: '#8B5CF6', blue: '#3B82F6', green: '#22C55E', amber: '#F59E0B',
    text: '#ECE9FF', text2: '#C3BCE8', muted: '#8F87B8', grid: 'rgba(139,92,246,0.14)'
  };

  const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reducedMotion = () => reducedMotionQuery.matches;

  function storageGet(key, fallback) {
    try { const v = window.localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable — ignore */ }
  }

  let toastTimer = null;
  function toast(msg, type = '') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast ' + type; }, 3200);
  }

  /* ------------------------------------------------------------------
     Data generation
     ------------------------------------------------------------------ */
  const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  function generateArray(size, pattern) {
    const maxV = 300;
    let arr;
    switch (pattern) {
      case 'sorted':
        arr = Array.from({ length: size }, () => randInt(5, maxV)).sort((a, b) => a - b); break;
      case 'reversed':
        arr = Array.from({ length: size }, () => randInt(5, maxV)).sort((a, b) => b - a); break;
      case 'nearly': {
        arr = Array.from({ length: size }, () => randInt(5, maxV)).sort((a, b) => a - b);
        const swaps = Math.max(1, Math.round(size * 0.08));
        for (let k = 0; k < swaps; k++) {
          const i = randInt(0, size - 1);
          const j = clamp(i + randInt(-3, 3), 0, size - 1);
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        break;
      }
      case 'few': {
        const pool = Array.from({ length: Math.min(5, size) }, () => randInt(10, maxV));
        arr = Array.from({ length: size }, () => pool[randInt(0, pool.length - 1)]); break;
      }
      default:
        arr = Array.from({ length: size }, () => randInt(5, maxV));
    }
    return arr;
  }

  function parseCustom(text) {
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    if (parts.length < 5 || parts.length > 100) return { error: `Enter between 5 and 100 numbers (you entered ${parts.length}).` };
    const arr = [];
    for (const p of parts) {
      const v = Number(p);
      if (!Number.isFinite(v)) return { error: `"${p}" is not a valid number.` };
      if (Math.abs(v) > 1e6) return { error: `Values must be between -1,000,000 and 1,000,000 ("${p}").` };
      arr.push(v);
    }
    return { arr };
  }

  /* ------------------------------------------------------------------
     Recorder — every algorithm talks to the array only through this.
     ------------------------------------------------------------------ */
  class Recorder {
    constructor(arr, asc, record) {
      this.a = arr;
      this.asc = asc;
      this.record = record;
      this.steps = [];
      this.comparisons = 0;
      this.swaps = 0;
      this.writes = 0;
    }
    // true when x must come AFTER y in the requested order
    after(x, y) { return this.asc ? x > y : x < y; }
    /* Compare (and highlight i, j). Optional explicit values for keys held outside the array. */
    cmp(i, j, x, y) {
      if (x === undefined) x = this.a[i];
      if (y === undefined) y = this.a[j];
      this.comparisons++;
      if (this.record) this.steps.push({ t: 'cmp', i, j });
      return this.after(x, y);
    }
    swap(i, j) {
      const a = this.a; const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      this.swaps++;
      if (this.record) this.steps.push({ t: 'swap', i, j });
    }
    write(i, v) {
      this.a[i] = v;
      this.writes++;
      if (this.record) this.steps.push({ t: 'write', i, v });
    }
    read(i) { if (this.record) this.steps.push({ t: 'read', i }); }
    mark(i) { if (this.record) this.steps.push({ t: 'mark', i }); }
    markRange(lo, hi) { if (this.record) this.steps.push({ t: 'markRange', lo, hi }); }
    pivot(i) { if (this.record) this.steps.push({ t: 'pivot', i }); }
    range(lo, hi) { if (this.record) this.steps.push({ t: 'range', lo, hi }); }
    note(text) { if (this.record) this.steps.push({ t: 'note', text }); }
  }

  /* ------------------------------------------------------------------
     Algorithm Engine
     ------------------------------------------------------------------ */
  function bubbleSort(r) {
    const a = r.a, n = a.length;
    for (let i = 0; i < n - 1; i++) {
      r.note(`Pass ${i + 1}: comparing neighbours, pushing the next extreme value to index ${n - 1 - i}`);
      let swapped = false;
      for (let j = 0; j < n - 1 - i; j++) {
        if (r.cmp(j, j + 1)) { r.swap(j, j + 1); swapped = true; }
      }
      r.mark(n - 1 - i);
      if (!swapped) { r.note(`Pass ${i + 1} made no swaps → array is sorted (early exit)`); r.markRange(0, n - 1); return; }
    }
    if (n) r.mark(0);
  }

  function selectionSort(r) {
    const a = r.a, n = a.length;
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      r.pivot(m);
      r.note(`Scanning indices ${i}–${n - 1} for the ${r.asc ? 'minimum' : 'maximum'} (current: ${a[m]})`);
      for (let j = i + 1; j < n; j++) {
        if (r.cmp(m, j)) { m = j; r.pivot(m); r.note(`New ${r.asc ? 'minimum' : 'maximum'} found: ${a[m]} at index ${m}`); }
      }
      if (m !== i) { r.note(`Swapping ${a[m]} into position ${i}`); r.swap(i, m); }
      r.pivot(-1);
      r.mark(i);
    }
    if (n) r.mark(n - 1);
  }

  function insertionSort(r) {
    const a = r.a, n = a.length;
    for (let i = 1; i < n; i++) {
      const key = a[i];
      let j = i - 1;
      r.pivot(i);
      r.note(`Key = ${key}: shifting larger${r.asc ? '' : ' (smaller, for descending)'} elements one step right`);
      while (j >= 0 && r.cmp(j, j + 1, a[j], key)) {
        r.write(j + 1, a[j]);
        j--;
        r.pivot(j + 1);
      }
      if (j + 1 !== i) { r.write(j + 1, key); r.note(`Inserted ${key} at index ${j + 1}`); }
    }
    r.pivot(-1);
  }

  function mergeSort(r) {
    const a = r.a, n = a.length;
    const aux = new Array(n);
    const merge = (lo, mid, hi) => {
      r.range(lo, hi);
      r.note(`Merging [${lo}…${mid}] with [${mid + 1}…${hi}]`);
      for (let k = lo; k <= hi; k++) aux[k] = a[k];
      let i = lo, j = mid + 1;
      for (let k = lo; k <= hi; k++) {
        let v;
        if (i > mid) v = aux[j++];
        else if (j > hi) v = aux[i++];
        else if (r.cmp(i, j, aux[i], aux[j])) v = aux[j++]; // right element comes first
        else v = aux[i++];                                   // ties take left → stable
        r.write(k, v);
      }
    };
    const sort = (lo, hi) => {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1;
      sort(lo, mid);
      sort(mid + 1, hi);
      merge(lo, mid, hi);
    };
    sort(0, n - 1);
    r.range(-1, -1);
  }

  function quickSort(r) {
    const a = r.a, n = a.length;
    const sort = (lo, hi) => {
      if (lo > hi) return;
      if (lo === hi) { r.mark(lo); return; }
      r.range(lo, hi);
      const mid = (lo + hi) >> 1;
      if (mid !== hi) r.swap(mid, hi);             // middle element as pivot, moved to the end
      r.pivot(hi);
      r.note(`Partitioning [${lo}…${hi}] around pivot ${a[hi]}`);
      let i = lo - 1;
      for (let j = lo; j < hi; j++) {
        if (r.cmp(hi, j)) {                         // a[j] belongs before the pivot
          i++;
          if (i !== j) r.swap(i, j);
        }
      }
      const p = i + 1;
      if (p !== hi) r.swap(p, hi);
      r.pivot(-1);
      r.mark(p);
      r.note(`Pivot ${a[p]} fixed at index ${p}`);
      sort(lo, p - 1);
      sort(p + 1, hi);
    };
    sort(0, n - 1);
    r.range(-1, -1);
  }

  function heapSort(r) {
    const a = r.a, n = a.length;
    const sift = (i, size) => {
      for (;;) {
        const l = 2 * i + 1, rt = l + 1;
        let top = i;
        if (l < size && r.cmp(l, top)) top = l;
        if (rt < size && r.cmp(rt, top)) top = rt;
        if (top === i) return;
        r.swap(i, top);
        i = top;
      }
    };
    r.note(`Building a ${r.asc ? 'max' : 'min'}-heap from the array`);
    r.range(0, n - 1);
    for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
    for (let end = n - 1; end > 0; end--) {
      r.note(`Moving heap root ${a[0]} to index ${end}, then restoring the heap`);
      r.swap(0, end);
      r.mark(end);
      r.range(0, end - 1);
      sift(0, end);
    }
    if (n) r.mark(0);
    r.range(-1, -1);
  }

  function countingSort(r) {
    const a = r.a, n = a.length;
    if (!n) return;
    let min = a[0], max = a[0];
    for (let i = 1; i < n; i++) { if (a[i] < min) min = a[i]; if (a[i] > max) max = a[i]; }
    const k = max - min + 1;
    const count = new Array(k).fill(0);
    r.note(`Counting phase: tallying ${n} values in a count array of size ${k} (range ${min}–${max})`);
    for (let i = 0; i < n; i++) { r.read(i); count[a[i] - min]++; }
    r.note('Reconstruction phase: writing each value back as many times as it was counted');
    let pos = 0;
    if (r.asc) {
      for (let v = 0; v < k; v++) for (let c = 0; c < count[v]; c++) { r.write(pos, v + min); r.mark(pos); pos++; }
    } else {
      for (let v = k - 1; v >= 0; v--) for (let c = 0; c < count[v]; c++) { r.write(pos, v + min); r.mark(pos); pos++; }
    }
  }

  function radixSort(r) {
    const a = r.a, n = a.length;
    if (!n) return;
    let max = a[0];
    for (let i = 1; i < n; i++) if (a[i] > max) max = a[i];
    const placeNames = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions'];
    let exp = 1, pass = 0;
    do {
      const place = placeNames[pass] || `10^${pass}`;
      r.note(`Pass ${pass + 1}: distributing into buckets 0–9 by the ${place} digit`);
      const buckets = Array.from({ length: 10 }, () => []);
      for (let i = 0; i < n; i++) { r.read(i); buckets[Math.floor(a[i] / exp) % 10].push(a[i]); }
      r.note(`Pass ${pass + 1}: collecting buckets ${r.asc ? '0 → 9' : '9 → 0'} back into the array (stable)`);
      let k = 0;
      for (let d = 0; d < 10; d++) {
        const b = buckets[r.asc ? d : 9 - d];
        for (let t = 0; t < b.length; t++) r.write(k++, b[t]);
      }
      exp *= 10; pass++;
    } while (Math.floor(max / exp) > 0);
  }

  function bucketSort(r) {
    const a = r.a, n = a.length;
    if (n < 2) return;
    let min = a[0], max = a[0];
    for (let i = 1; i < n; i++) { if (a[i] < min) min = a[i]; if (a[i] > max) max = a[i]; }
    if (min === max) { r.note('All values are equal — nothing to do'); return; }
    const bc = Math.max(2, Math.round(Math.sqrt(n)));
    const buckets = Array.from({ length: bc }, () => []);
    r.note(`Distribution: placing each value into one of ${bc} buckets by its value range`);
    for (let i = 0; i < n; i++) {
      r.read(i);
      let b = Math.floor(((a[i] - min) / (max - min)) * bc);
      if (b >= bc) b = bc - 1;
      buckets[b].push(a[i]);
    }
    r.note(`Collection: concatenating buckets ${r.asc ? 'low → high' : 'high → low'}`);
    const segs = [];
    let k = 0;
    for (let t = 0; t < bc; t++) {
      const b = buckets[r.asc ? t : bc - 1 - t];
      const start = k;
      for (let q = 0; q < b.length; q++) r.write(k++, b[q]);
      if (b.length) segs.push([start, k - 1]);
    }
    segs.forEach(([lo, hi], idx) => {
      r.range(lo, hi);
      r.note(`Insertion-sorting bucket ${idx + 1} of ${segs.length} (indices ${lo}–${hi})`);
      for (let i = lo + 1; i <= hi; i++) {
        const key = a[i];
        let j = i - 1;
        while (j >= lo && r.cmp(j, j + 1, a[j], key)) { r.write(j + 1, a[j]); j--; }
        if (j + 1 !== i) r.write(j + 1, key);
      }
      r.markRange(lo, hi);
    });
    r.range(-1, -1);
  }

  function shellSort(r) {
    const a = r.a, n = a.length;
    for (let gap = n >> 1; gap > 0; gap >>= 1) {
      r.note(`Gap = ${gap}: gapped insertion sort on elements ${gap} apart`);
      for (let i = gap; i < n; i++) {
        const tmp = a[i];
        let j = i;
        while (j >= gap && r.cmp(j - gap, j, a[j - gap], tmp)) { r.write(j, a[j - gap]); j -= gap; }
        if (j !== i) r.write(j, tmp);
      }
    }
  }

  /* ------------------------------------------------------------------
     Algorithm metadata + learning content
     ------------------------------------------------------------------ */
  const ALGOS = {
    bubble: {
      name: 'Bubble Sort', fn: bubbleSort, type: 'Comparison · In-place · Stable', stable: true, intOnly: false,
      best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)',
      summary: 'Repeatedly walks through the list, comparing each pair of neighbours and swapping them if they are in the wrong order. Large values "bubble" to the end like air bubbles rising in water.',
      how: [
        'Start at the beginning of the array and compare elements 0 and 1.',
        'If they are out of order, swap them; then move one position right and repeat.',
        'After one full pass the largest element is guaranteed to be at the end.',
        'Repeat passes over the shrinking unsorted portion.',
        'If a pass makes no swaps, the array is already sorted — stop early.'
      ],
      example: [
        'Array: [5, 1, 4, 2, 8]',
        'Pass 1: (5,1) swap → [1,5,4,2,8]; (5,4) swap → [1,4,5,2,8]; (5,2) swap → [1,4,2,5,8]; (5,8) OK. 8 is in place.',
        'Pass 2: (1,4) OK; (4,2) swap → [1,2,4,5,8]; (4,5) OK. 5 is in place.',
        'Pass 3: no swaps happen → early exit.',
        'Result: [1, 2, 4, 5, 8]'
      ],
      pseudo: `<span class="kw">procedure</span> bubbleSort(A)
  n ← length(A)
  <span class="kw">for</span> i ← 0 <span class="kw">to</span> n − 2
    swapped ← false
    <span class="kw">for</span> j ← 0 <span class="kw">to</span> n − 2 − i
      <span class="kw">if</span> A[j] > A[j + 1] <span class="kw">then</span>
        swap(A[j], A[j + 1])
        swapped ← true
    <span class="kw">if not</span> swapped <span class="kw">then break</span>   <span class="cm">// already sorted</span>`,
      pros: ['Extremely simple to understand and implement', 'Stable and in-place (O(1) extra memory)', 'Detects an already-sorted array in one O(n) pass'],
      cons: ['O(n²) comparisons and swaps on average — very slow for large inputs', 'Performs many more swaps than Selection or Insertion Sort'],
      uses: ['Teaching the basic idea of sorting and algorithm analysis', 'Checking whether a small list is already sorted', 'Tiny embedded systems where code size matters more than speed']
    },
    selection: {
      name: 'Selection Sort', fn: selectionSort, type: 'Comparison · In-place · Not stable', stable: false, intOnly: false,
      best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)',
      summary: 'Divides the array into a sorted left part and an unsorted right part. Each round it selects the smallest remaining element and swaps it to the end of the sorted part.',
      how: [
        'Assume the first unsorted element is the minimum.',
        'Scan the rest of the unsorted part; remember the index of any smaller element.',
        'Swap the minimum found into the first unsorted position.',
        'The sorted part grows by one; repeat until one element remains.'
      ],
      example: [
        'Array: [64, 25, 12, 22, 11]',
        'i = 0: minimum is 11 → swap with 64 → [11, 25, 12, 22, 64]',
        'i = 1: minimum is 12 → swap with 25 → [11, 12, 25, 22, 64]',
        'i = 2: minimum is 22 → swap with 25 → [11, 12, 22, 25, 64]',
        'i = 3: minimum is 25 → already in place. Result: [11, 12, 22, 25, 64]'
      ],
      pseudo: `<span class="kw">procedure</span> selectionSort(A)
  n ← length(A)
  <span class="kw">for</span> i ← 0 <span class="kw">to</span> n − 2
    min ← i
    <span class="kw">for</span> j ← i + 1 <span class="kw">to</span> n − 1
      <span class="kw">if</span> A[j] < A[min] <span class="kw">then</span> min ← j
    <span class="kw">if</span> min ≠ i <span class="kw">then</span> swap(A[i], A[min])`,
      pros: ['At most n − 1 swaps — useful when writes are expensive (e.g. flash memory)', 'Simple, in-place, predictable running time'],
      cons: ['Always O(n²) comparisons, even if the input is already sorted', 'Not stable in its standard form'],
      uses: ['Systems where memory writes are costly', 'Small arrays in teaching and embedded code', 'Finding the k smallest items when k is very small']
    },
    insertion: {
      name: 'Insertion Sort', fn: insertionSort, type: 'Comparison · In-place · Stable · Adaptive', stable: true, intOnly: false,
      best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)',
      summary: 'Builds the sorted array one item at a time, the way people sort playing cards in their hand: take the next card and slide it left until it fits.',
      how: [
        'Treat the first element as a sorted sub-list.',
        'Take the next element as the "key".',
        'Shift every sorted element that is larger than the key one position to the right.',
        'Insert the key into the gap that is left.',
        'Repeat for every element.'
      ],
      example: [
        'Array: [12, 11, 13, 5, 6]',
        'Key 11: shift 12 right → [11, 12, 13, 5, 6]',
        'Key 13: already larger than 12 → no change',
        'Key 5: shift 13, 12, 11 right → [5, 11, 12, 13, 6]',
        'Key 6: shift 13, 12, 11 right → [5, 6, 11, 12, 13]'
      ],
      pseudo: `<span class="kw">procedure</span> insertionSort(A)
  <span class="kw">for</span> i ← 1 <span class="kw">to</span> length(A) − 1
    key ← A[i]
    j ← i − 1
    <span class="kw">while</span> j ≥ 0 <span class="kw">and</span> A[j] > key
      A[j + 1] ← A[j]        <span class="cm">// shift right</span>
      j ← j − 1
    A[j + 1] ← key           <span class="cm">// insert</span>`,
      pros: ['Very fast on small or nearly-sorted data (close to O(n))', 'Stable, in-place and online (can sort data as it arrives)', 'Low overhead — used inside hybrid sorts'],
      cons: ['O(n²) on random or reverse-sorted data', 'Many element shifts for large inputs'],
      uses: ['Small sub-arrays inside Tim Sort and Intro Sort', 'Maintaining a sorted list as new items arrive', 'Nearly-sorted data such as log files with slight disorder']
    },
    merge: {
      name: 'Merge Sort', fn: mergeSort, type: 'Comparison · Divide & conquer · Stable', stable: true, intOnly: false,
      best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)',
      summary: 'A divide-and-conquer algorithm: split the array in half, sort each half recursively, then merge the two sorted halves into one sorted array.',
      how: [
        'If the array has 0 or 1 elements, it is already sorted.',
        'Split the array into two halves at the midpoint.',
        'Recursively Merge Sort each half.',
        'Merge: repeatedly compare the front elements of both halves and write the smaller one into the result.',
        'Copy any remaining elements.'
      ],
      example: [
        'Array: [38, 27, 43, 3]',
        'Split → [38, 27] and [43, 3] → [38] [27] [43] [3]',
        'Merge [38] + [27] → [27, 38]; merge [43] + [3] → [3, 43]',
        'Merge [27, 38] + [3, 43]: 3 < 27 → 3; 27 < 43 → 27; 38 < 43 → 38; then 43',
        'Result: [3, 27, 38, 43]'
      ],
      pseudo: `<span class="kw">procedure</span> mergeSort(A, lo, hi)
  <span class="kw">if</span> lo ≥ hi <span class="kw">then return</span>
  mid ← ⌊(lo + hi) / 2⌋
  mergeSort(A, lo, mid)
  mergeSort(A, mid + 1, hi)
  merge(A, lo, mid, hi)

<span class="kw">procedure</span> merge(A, lo, mid, hi)
  copy A[lo..hi] into aux
  i ← lo; j ← mid + 1
  <span class="kw">for</span> k ← lo <span class="kw">to</span> hi
    <span class="kw">if</span> i > mid <span class="kw">then</span> A[k] ← aux[j++]
    <span class="kw">else if</span> j > hi <span class="kw">then</span> A[k] ← aux[i++]
    <span class="kw">else if</span> aux[j] < aux[i] <span class="kw">then</span> A[k] ← aux[j++]
    <span class="kw">else</span> A[k] ← aux[i++]`,
      pros: ['Guaranteed O(n log n) in every case', 'Stable — preserves the order of equal keys', 'Excellent for linked lists and external (disk-based) sorting'],
      cons: ['Needs O(n) extra memory for arrays', 'Slower than Quick Sort in practice on in-memory arrays due to copying'],
      uses: ['External sorting of huge files that do not fit in RAM', 'Sorting linked lists', 'Basis of Tim Sort (Python, Java object sorting)', 'Counting inversions in data analysis']
    },
    quick: {
      name: 'Quick Sort', fn: quickSort, type: 'Comparison · Divide & conquer · Not stable', stable: false, intOnly: false,
      best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)',
      summary: 'Picks a pivot, partitions the array so smaller elements go left and larger ones go right, then recursively sorts both sides. The pivot ends in its final position after each partition.',
      how: [
        'Choose a pivot (this visualizer uses the middle element, moved to the end).',
        'Partition (Lomuto scheme): walk through the range; every element smaller than the pivot is swapped into the growing left region.',
        'Swap the pivot just after the left region — it is now in its final place.',
        'Recursively Quick Sort the left and right parts.'
      ],
      example: [
        'Array: [10, 80, 30, 90, 40, 50, 70], pivot = 70 (last element)',
        '10 < 70 → left; 80 stays; 30 < 70 → swap → [10, 30, 80, 90, 40, 50, 70]',
        '40 < 70 → swap → [10, 30, 40, 90, 80, 50, 70]; 50 < 70 → swap → [10, 30, 40, 50, 80, 90, 70]',
        'Place pivot: swap 70 with 80 → [10, 30, 40, 50, 70, 90, 80]. 70 is final.',
        'Recurse on [10, 30, 40, 50] and [90, 80] → [10, 30, 40, 50, 70, 80, 90]'
      ],
      pseudo: `<span class="kw">procedure</span> quickSort(A, lo, hi)
  <span class="kw">if</span> lo < hi <span class="kw">then</span>
    p ← partition(A, lo, hi)
    quickSort(A, lo, p − 1)
    quickSort(A, p + 1, hi)

<span class="kw">procedure</span> partition(A, lo, hi)
  swap(A[⌊(lo+hi)/2⌋], A[hi])     <span class="cm">// middle pivot</span>
  pivot ← A[hi]; i ← lo − 1
  <span class="kw">for</span> j ← lo <span class="kw">to</span> hi − 1
    <span class="kw">if</span> A[j] < pivot <span class="kw">then</span>
      i ← i + 1; swap(A[i], A[j])
  swap(A[i + 1], A[hi])
  <span class="kw">return</span> i + 1`,
      pros: ['Usually the fastest comparison sort in practice (cache-friendly, in-place)', 'Only O(log n) stack space on average'],
      cons: ['Worst case O(n²) with bad pivots (e.g. many duplicates with Lomuto partitioning)', 'Not stable', 'Recursive — deep recursion on bad inputs'],
      uses: ['C qsort and C++ std::sort (as part of Intro Sort)', 'Sorting primitive arrays in Java (dual-pivot Quick Sort)', 'Quick Select for finding medians / k-th smallest']
    },
    heap: {
      name: 'Heap Sort', fn: heapSort, type: 'Comparison · In-place · Not stable', stable: false, intOnly: false,
      best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)',
      summary: 'Turns the array into a binary max-heap (every parent ≥ its children), then repeatedly moves the root — the maximum — to the end and repairs the heap.',
      how: [
        'Build a max-heap: call sift-down on every non-leaf node from the bottom up.',
        'The largest element is now at index 0.',
        'Swap it with the last element of the heap and shrink the heap by one.',
        'Sift the new root down to restore the heap property.',
        'Repeat until the heap has one element.'
      ],
      example: [
        'Array: [4, 10, 3, 5, 1]',
        'Build heap: 4 sinks below 10, then below 5 → [10, 5, 3, 4, 1]',
        'Swap root 10 to the end → [1, 5, 3, 4, 10]; sift 1 down → [5, 4, 3, 1, 10]',
        'Swap 5 to index 3 → [1, 4, 3, 5, 10]; sift → [4, 1, 3, 5, 10]',
        'Swap 4 → [3, 1, 4, 5, 10]; swap 3 → [1, 3, 4, 5, 10]. Done.'
      ],
      pseudo: `<span class="kw">procedure</span> heapSort(A)
  n ← length(A)
  <span class="kw">for</span> i ← ⌊n/2⌋ − 1 <span class="kw">downto</span> 0
    siftDown(A, i, n)              <span class="cm">// build max-heap</span>
  <span class="kw">for</span> end ← n − 1 <span class="kw">downto</span> 1
    swap(A[0], A[end])
    siftDown(A, 0, end)

<span class="kw">procedure</span> siftDown(A, i, size)
  <span class="kw">loop</span>
    largest ← i; l ← 2i + 1; r ← 2i + 2
    <span class="kw">if</span> l < size <span class="kw">and</span> A[l] > A[largest] <span class="kw">then</span> largest ← l
    <span class="kw">if</span> r < size <span class="kw">and</span> A[r] > A[largest] <span class="kw">then</span> largest ← r
    <span class="kw">if</span> largest = i <span class="kw">then return</span>
    swap(A[i], A[largest]); i ← largest`,
      pros: ['Guaranteed O(n log n) with only O(1) extra memory', 'No bad-case inputs like Quick Sort'],
      cons: ['Not stable', 'Poor cache locality — often slower than Quick Sort in practice'],
      uses: ['Fallback inside Intro Sort when Quick Sort recursion gets too deep', 'Priority queues, task schedulers, Dijkstra / Prim algorithms', 'Memory-constrained and real-time systems needing worst-case guarantees']
    },
    counting: {
      name: 'Counting Sort', fn: countingSort, type: 'Non-comparison · Integer keys', stable: true, intOnly: true,
      best: 'O(n + k)', avg: 'O(n + k)', worst: 'O(n + k)', space: 'O(n + k)',
      summary: 'Does not compare elements at all. It counts how many times each value occurs, then rebuilds the array from those counts. k is the range of values (max − min + 1).',
      how: [
        'Find the minimum and maximum values to size the count array (k = max − min + 1).',
        'Counting phase: for every element, increment count[value − min].',
        'Reconstruction phase: walk the count array in order and write each value back count[v] times.',
        '(The stable textbook version turns counts into prefix sums and places items into an output array from right to left.)'
      ],
      example: [
        'Array: [4, 2, 2, 8, 3, 3, 1]  → range 1…8',
        'Counts: 1→1, 2→2, 3→2, 4→1, 5→0, 6→0, 7→0, 8→1',
        'Write 1 once, 2 twice, 3 twice, 4 once, 8 once',
        'Result: [1, 2, 2, 3, 3, 4, 8] — zero element comparisons'
      ],
      pseudo: `<span class="kw">procedure</span> countingSort(A)
  min ← minimum(A); max ← maximum(A)
  count[0 .. max − min] ← 0
  <span class="kw">for each</span> x <span class="kw">in</span> A
    count[x − min] ← count[x − min] + 1
  pos ← 0
  <span class="kw">for</span> v ← 0 <span class="kw">to</span> max − min
    <span class="kw">repeat</span> count[v] <span class="kw">times</span>
      A[pos] ← v + min; pos ← pos + 1`,
      pros: ['Linear time when the value range k is not much larger than n', 'No comparisons at all', 'Stable (prefix-sum version) — used as a building block of Radix Sort'],
      cons: ['Only works on integers (or keys that map to small integers)', 'Memory grows with the value range — impractical for values like 1 … 10⁹'],
      uses: ['Sorting exam scores, ages, pixel intensities (0–255)', 'Histogram computation', 'Digit-sorting step inside Radix Sort'],
      restriction: 'Requires whole numbers ≥ 0 in this visualizer. Decimals cannot be used as array indexes, and the count array would need one slot per possible value.'
    },
    radix: {
      name: 'Radix Sort', fn: radixSort, type: 'Non-comparison · LSD · Stable', stable: true, intOnly: true,
      best: 'O(d·(n + b))', avg: 'O(d·(n + b))', worst: 'O(d·(n + b))', space: 'O(n + b)',
      summary: 'Sorts integers digit by digit, starting from the least significant digit (LSD). Each pass is a stable bucket distribution on one digit, so earlier passes are preserved. d = number of digits, b = base (10).',
      how: [
        'Find the largest number to know how many digit passes (d) are needed.',
        'For the ones digit, distribute every number into buckets 0–9.',
        'Collect the buckets in order back into the array — keeping the order within each bucket (stable).',
        'Repeat for the tens digit, hundreds digit, … until all digits are processed.'
      ],
      example: [
        'Array: [170, 45, 75, 90, 802, 24, 2, 66]',
        'Ones digit → [170, 90, 802, 2, 24, 45, 75, 66]',
        'Tens digit → [802, 2, 24, 45, 66, 170, 75, 90]',
        'Hundreds digit → [2, 24, 45, 66, 75, 90, 170, 802]',
        'Sorted after 3 passes, with zero element comparisons'
      ],
      pseudo: `<span class="kw">procedure</span> radixSort(A)
  max ← maximum(A); exp ← 1
  <span class="kw">repeat</span>
    buckets[0..9] ← empty lists
    <span class="kw">for each</span> x <span class="kw">in</span> A
      append x to buckets[⌊x / exp⌋ mod 10]
    A ← concatenate(buckets[0], …, buckets[9])
    exp ← exp × 10
  <span class="kw">until</span> ⌊max / exp⌋ = 0`,
      pros: ['Linear time for fixed-width keys', 'Stable; no comparisons', 'Scales well for large numbers of short keys (IDs, phone numbers)'],
      cons: ['Needs extra memory for buckets', 'Restricted to integers or fixed-length strings', 'Running time depends on the number of digits'],
      uses: ['Sorting large sets of integers, IP addresses, dates', 'Suffix-array construction in string processing', 'GPU sorting (parallel radix sort)'],
      restriction: 'Requires whole numbers ≥ 0 in this visualizer, because each pass extracts decimal digits with ⌊x / 10ᵏ⌋ mod 10.'
    },
    bucket: {
      name: 'Bucket Sort', fn: bucketSort, type: 'Distribution · Stable (with stable inner sort)', stable: true, intOnly: false,
      best: 'O(n + k)', avg: 'O(n + k)', worst: 'O(n²)', space: 'O(n + k)',
      summary: 'Spreads values into k buckets that each cover an equal slice of the value range, sorts each bucket (here with Insertion Sort), then concatenates the buckets.',
      how: [
        'Find the minimum and maximum; create k ≈ √n buckets of equal range width.',
        'Distribution: put each value into bucket ⌊(x − min) / (max − min) × k⌋.',
        'Collection: write the buckets back to the array in order.',
        'Sort each bucket\'s slice with Insertion Sort.'
      ],
      example: [
        'Array: [29, 25, 3, 49, 9, 37, 21, 43], 5 buckets of width 10',
        '0–9: [3, 9] · 10–19: [ ] · 20–29: [29, 25, 21] · 30–39: [37] · 40–49: [49, 43]',
        'Sort each bucket: [3, 9] · [21, 25, 29] · [37] · [43, 49]',
        'Concatenate → [3, 9, 21, 25, 29, 37, 43, 49]'
      ],
      pseudo: `<span class="kw">procedure</span> bucketSort(A, k)
  min ← minimum(A); max ← maximum(A)
  buckets[0..k−1] ← empty lists
  <span class="kw">for each</span> x <span class="kw">in</span> A
    b ← ⌊(x − min) / (max − min) × k⌋, capped at k − 1
    append x to buckets[b]
  A ← concatenate(buckets)
  <span class="kw">for each</span> bucket slice <span class="kw">in</span> A
    insertionSort(slice)`,
      pros: ['Average linear time when values are uniformly distributed', 'Works with decimals and negative numbers', 'Buckets can be sorted in parallel'],
      cons: ['Degrades to O(n²) when most values land in one bucket', 'Needs extra memory for buckets', 'Performance depends on knowing the data distribution'],
      uses: ['Sorting uniformly distributed floating-point numbers (e.g. 0.0–1.0)', 'Histogram-based grading and analytics', 'Parallel and distributed sorting (e.g. sample sort)']
    },
    shell: {
      name: 'Shell Sort', fn: shellSort, type: 'Comparison · In-place · Not stable', stable: false, intOnly: false,
      best: 'O(n log n)', avg: '≈ O(n^1.5)', worst: 'O(n²)', space: 'O(1)',
      summary: 'A generalisation of Insertion Sort that first sorts elements far apart (a "gap") and then shrinks the gap. Far-away moves remove large-scale disorder early, so the final gap-1 insertion pass is fast.',
      how: [
        'Start with gap = ⌊n / 2⌋ (Shell\'s original sequence, used here).',
        'Do an insertion sort where each element is compared with the one gap positions before it, shifting by gap.',
        'Halve the gap and repeat.',
        'The last pass has gap = 1 — an ordinary insertion sort on almost-sorted data.'
      ],
      example: [
        'Array: [23, 12, 1, 8, 34, 54, 2, 3]  (n = 8)',
        'Gap 4: compare pairs 4 apart; only (8, 3) is out of order → [23, 12, 1, 3, 34, 54, 2, 8]',
        'Gap 2: gapped insertion → [1, 3, 2, 8, 23, 12, 34, 54]',
        'Gap 1: normal insertion on nearly sorted data → [1, 2, 3, 8, 12, 23, 34, 54]'
      ],
      pseudo: `<span class="kw">procedure</span> shellSort(A)
  n ← length(A)
  gap ← ⌊n / 2⌋
  <span class="kw">while</span> gap > 0
    <span class="kw">for</span> i ← gap <span class="kw">to</span> n − 1
      tmp ← A[i]; j ← i
      <span class="kw">while</span> j ≥ gap <span class="kw">and</span> A[j − gap] > tmp
        A[j] ← A[j − gap]; j ← j − gap
      A[j] ← tmp
    gap ← ⌊gap / 2⌋`,
      pros: ['Much faster than Insertion Sort on medium-sized arrays', 'In-place with O(1) memory and no recursion', 'Simple code — popular in embedded systems'],
      cons: ['Not stable', 'Exact complexity depends on the gap sequence (with n/2ᵏ gaps the worst case is O(n²))'],
      uses: ['Embedded systems and the uClibc qsort implementation', 'Medium-sized arrays where recursion is undesirable', 'Linux kernel bzip2 decompression code historically']
    }
  };
  const ALGO_KEYS = Object.keys(ALGOS);

  function validateFor(key, arr) {
    const algo = ALGOS[key];
    if (!algo.intOnly) return null;
    const bad = arr.find((v) => !Number.isInteger(v) || v < 0);
    if (bad !== undefined) return `${algo.name} needs whole numbers ≥ 0 (found ${bad}). Pick a comparison sort or Bucket Sort for decimals/negatives.`;
    if (key === 'counting') {
      const span = Math.max(...arr) - Math.min(...arr);
      if (span > 100000) return 'Counting Sort: value range is too large (max − min must be ≤ 100,000).';
    }
    return null;
  }

  function isSortedBy(arr, asc) {
    for (let i = 1; i < arr.length; i++) if (asc ? arr[i - 1] > arr[i] : arr[i - 1] < arr[i]) return false;
    return true;
  }
  function sameMultiset(a, b) {
    if (a.length !== b.length) return false;
    const x = a.slice().sort((p, q) => p - q), y = b.slice().sort((p, q) => p - q);
    return x.every((v, i) => v === y[i]);
  }

  /* Run an algorithm with recording. Verifies the output. */
  function runRecorded(key, input, asc) {
    const work = input.slice();
    const rec = new Recorder(work, asc, true);
    ALGOS[key].fn(rec);
    const ok = isSortedBy(work, asc) && sameMultiset(work, input);
    if (!ok) console.warn(`[SORTNEXUS] Verification failed for ${key}`);
    return { steps: rec.steps, comparisons: rec.comparisons, swaps: rec.swaps, writes: rec.writes, result: work, ok };
  }

  /* Measure real CPU time (no step recording). Repeats until ~8 ms to get a stable average. */
  function measureCPU(key, input, asc) {
    const fn = ALGOS[key].fn;
    let reps = 0, total = 0, counts = null, ok = true;
    const budget = 8;
    while (reps < 500) {
      const work = input.slice();
      const rec = new Recorder(work, asc, false);
      const t0 = performance.now();
      fn(rec);
      total += performance.now() - t0;
      if (!counts) {
        counts = { comparisons: rec.comparisons, swaps: rec.swaps, writes: rec.writes };
        ok = isSortedBy(work, asc) && sameMultiset(work, input);
      }
      reps++;
      if (total >= budget && reps >= 3) break;
    }
    return { ms: total / reps, reps, ok, ...counts };
  }

  /* ------------------------------------------------------------------
     Sound engine (Web Audio, generated locally, muted by default)
     ------------------------------------------------------------------ */
  const Sound = {
    ctx: null, enabled: false, volume: 0.35, last: 0,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (e) { return null; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    },
    tone(ratio, kind) {
      if (!this.enabled || this.volume <= 0) return;
      const now = performance.now();
      if (now - this.last < 30) return;
      this.last = now;
      const ctx = this.ensure();
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'swap' ? 'triangle' : kind === 'read' ? 'square' : 'sine';
      o.frequency.value = 160 + clamp(ratio, 0, 1) * 880;
      const t = ctx.currentTime;
      const peak = this.volume * (kind === 'read' ? 0.05 : 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.1);
    },
    chime() {
      if (!this.enabled || this.volume <= 0) return;
      const ctx = this.ensure();
      if (!ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        const t = ctx.currentTime + i * 0.09;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(this.volume * 0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.45);
      });
    }
  };

  /* ------------------------------------------------------------------
     Bar renderer + Player
     ------------------------------------------------------------------ */
  const speedToSps = (s) => 2 * Math.pow(1500, (clamp(s, 1, 100) - 1) / 99); // steps per second: 2 … 3000

  const FREE_STEPS = { mark: 1, markRange: 1, pivot: 1, range: 1, note: 1 };

  class Player {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts;               // { onUpdate, onDone, onNote, sound }
      this.speed = 50;
      this.base = [];
      this.runId = 0;
      this.raf = 0;
      this.dpr = 1; this.w = 0; this.h = 0;
      this.reset();
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(canvas.parentElement);
      this.resize();
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.draw();
    }

    load(arr) { this.base = arr.slice(); this.reset(); }

    reset() {
      cancelAnimationFrame(this.raf);
      this.runId++;
      this.arr = this.base.slice();
      this.steps = null;
      this.plan = null;
      this.idx = 0;
      this.stats = { comparisons: 0, swaps: 0, writes: 0 };
      this.hl = null;                 // { kind, i, j }
      this.sorted = new Uint8Array(this.arr.length);
      this.pivotIdx = -1;
      this.active = null;             // [lo, hi]
      this.elapsed = 0;
      this.lastTs = 0;
      this.budget = 0;
      this.state = 'idle';            // idle | running | paused | finishing | done
      this.finishT = 0;
      this.cpu = null;
      this.algoKey = null;
      this.asc = true;
      this.computeScale();
      this.draw();
      this.emit();
    }

    computeScale() {
      const a = this.base;
      let lo = 0, hi = 0;
      for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi === lo) hi = lo + 1;
      this.lo = lo; this.hi = hi;
    }

    /* Prepare a run. Returns an error string or null. */
    prepare(key, asc) {
      const err = validateFor(key, this.base);
      if (err) return err;
      this.algoKey = key;
      this.asc = asc;
      const run = runRecorded(key, this.base, asc);
      this.plan = run;
      this.steps = run.steps;
      this.cpu = measureCPU(key, this.base, asc);
      return null;
    }

    start() {
      if (this.state === 'running') return;
      if (!this.steps) return;
      this.state = 'running';
      this.lastTs = 0;
      const id = this.runId;
      const loop = (ts) => {
        if (id !== this.runId || (this.state !== 'running' && this.state !== 'finishing')) return;
        this.tick(ts);
        if (id === this.runId && (this.state === 'running' || this.state === 'finishing')) this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
      this.emit();
    }

    pause() {
      if (this.state !== 'running') return;
      cancelAnimationFrame(this.raf);
      this.state = 'paused';
      this.emit();
    }

    resume() { if (this.state === 'paused') this.start(); }

    /* Apply exactly one "costed" step (plus any free steps before it). */
    stepOnce() {
      if (!this.steps || this.state === 'done' || this.state === 'finishing') return;
      if (this.state === 'running') this.pause();
      if (this.state === 'idle') this.state = 'paused';
      let applied = false;
      while (this.idx < this.steps.length && !applied) {
        const s = this.steps[this.idx++];
        applied = this.apply(s);
      }
      if (this.idx >= this.steps.length) this.beginFinish(true);
      this.draw();
      this.emit();
    }

    apply(s) {
      const a = this.arr;
      switch (s.t) {
        case 'cmp': this.stats.comparisons++; this.hl = { kind: 'cmp', i: s.i, j: s.j }; this.ping(s.i, 'cmp'); return true;
        case 'read': this.hl = { kind: 'cmp', i: s.i, j: -1 }; this.ping(s.i, 'read'); return true;
        case 'swap': { const t = a[s.i]; a[s.i] = a[s.j]; a[s.j] = t; this.stats.swaps++; this.hl = { kind: 'swap', i: s.i, j: s.j }; this.ping(s.j, 'swap'); return true; }
        case 'write': a[s.i] = s.v; this.stats.writes++; this.hl = { kind: 'swap', i: s.i, j: -1 }; this.ping(s.i, 'swap'); return true;
        case 'mark': if (s.i >= 0 && s.i < this.sorted.length) this.sorted[s.i] = 1; return false;
        case 'markRange': for (let k = s.lo; k <= s.hi; k++) this.sorted[k] = 1; return false;
        case 'pivot': this.pivotIdx = s.i; return false;
        case 'range': this.active = s.lo < 0 ? null : [s.lo, s.hi]; return false;
        case 'note': if (this.opts.onNote) this.opts.onNote(s.text); return false;
        default: return false;
      }
    }

    ping(i, kind) {
      if (!this.opts.sound) return;
      this.pendingSound = { ratio: (this.arr[i] - this.lo) / (this.hi - this.lo), kind };
    }

    tick(ts) {
      if (!this.lastTs) this.lastTs = ts;
      const dt = Math.min(100, ts - this.lastTs);
      this.lastTs = ts;

      if (this.state === 'finishing') {
        this.finishT += dt;
        const n = this.arr.length;
        const upto = Math.min(n, Math.ceil((this.finishT / 700) * n));
        for (let k = 0; k < upto; k++) this.sorted[k] = 1;
        if (upto >= n) this.complete();
        this.draw();
        return;
      }

      this.elapsed += dt;
      this.budget += (dt / 1000) * speedToSps(this.speed);
      if (this.budget > 4000) this.budget = 4000;
      this.pendingSound = null;
      while (this.budget >= 1 && this.idx < this.steps.length) {
        if (this.apply(this.steps[this.idx++])) this.budget -= 1;
      }
      if (this.pendingSound) Sound.tone(this.pendingSound.ratio, this.pendingSound.kind);
      if (this.idx >= this.steps.length) this.beginFinish(false);
      this.draw();
      this.emit();
    }

    beginFinish(immediate) {
      this.hl = null; this.pivotIdx = -1; this.active = null;
      if (immediate || reducedMotion()) { this.sorted.fill(1); this.complete(); return; }
      // Called from inside the running animation loop, which keeps going while state is 'finishing'.
      this.state = 'finishing';
      this.finishT = 0;
    }

    complete() {
      cancelAnimationFrame(this.raf);
      this.sorted.fill(1);
      this.hl = null;
      this.state = 'done';
      this.draw();
      this.emit();
      if (this.opts.onDone) this.opts.onDone(this);
    }

    progress() { return this.steps && this.steps.length ? this.idx / this.steps.length : (this.state === 'done' ? 1 : 0); }

    emit() { if (this.opts.onUpdate) this.opts.onUpdate(this); }

    draw() {
      const ctx = this.ctx, dpr = this.dpr, W = this.w, H = this.h;
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const a = this.arr, n = a.length;
      if (!n) return;

      const padX = 10, padTop = 26, padBottom = 10;
      const usableW = W - padX * 2;
      const gap = n > 70 ? 1 : n > 35 ? 2 : 4;
      const bw = Math.max(1, (usableW - gap * (n - 1)) / n);
      const plotH = H - padTop - padBottom;
      const range = this.hi - this.lo;
      const yOf = (v) => padTop + plotH * (1 - (v - this.lo) / range);
      const zeroY = yOf(0);
      const showVals = n <= 30 && bw >= 14;
      const radius = Math.min(4, bw / 3);

      // baseline
      ctx.strokeStyle = 'rgba(139,92,246,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padX, zeroY + 0.5); ctx.lineTo(W - padX, zeroY + 0.5); ctx.stroke();

      const grad = ctx.createLinearGradient(0, padTop, 0, H - padBottom);
      grad.addColorStop(0, COLORS.pink);
      grad.addColorStop(1, COLORS.blue);

      const hl = this.hl;
      for (let k = 0; k < n; k++) {
        const v = a[k];
        const x = padX + k * (bw + gap);
        const yTop = Math.min(yOf(v), zeroY);
        let hgt = Math.abs(zeroY - yOf(v));
        if (hgt < 2) hgt = 2;
        const y = v >= 0 ? zeroY - hgt : zeroY;

        let fill = grad, glow = null;
        const isHl = hl && (hl.i === k || hl.j === k);
        if (isHl && hl.kind === 'cmp') { fill = COLORS.amber; glow = COLORS.amber; }
        else if (isHl && hl.kind === 'swap') { fill = COLORS.purple; glow = COLORS.purple; }
        else if (k === this.pivotIdx) { fill = '#FFFFFF'; glow = '#93C5FD'; }
        else if (this.sorted[k]) { fill = COLORS.green; }

        const dim = this.active && (k < this.active[0] || k > this.active[1]) && !this.sorted[k];
        ctx.globalAlpha = dim ? 0.45 : 1;
        if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; } else { ctx.shadowBlur = 0; }
        ctx.fillStyle = fill;
        roundRect(ctx, x, v >= 0 ? y : yTop, bw, hgt, radius, v >= 0);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (showVals) {
          ctx.globalAlpha = dim ? 0.4 : 1;
          ctx.fillStyle = isHl || k === this.pivotIdx ? '#FFFFFF' : COLORS.text2;
          ctx.font = `600 ${bw >= 26 ? 12 : 10}px "Cascadia Code", Consolas, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const label = Number.isInteger(v) ? String(v) : String(+v.toFixed(2));
          const ly = v >= 0 ? y - 4 : zeroY - 4;
          ctx.fillText(label, x + bw / 2, ly);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function roundRect(ctx, x, y, w, h, r, topRounded) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (topRounded) {
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    }
    ctx.closePath();
  }

  /* ------------------------------------------------------------------
     Run log (shared by Arena + Battle, shown in Analytics)
     ------------------------------------------------------------------ */
  const runLog = [];
  function logRun(entry) {
    runLog.unshift(entry);
    if (runLog.length > 200) runLog.pop();
    renderLog();
  }
  function renderLog() {
    const tb = $('#logTable tbody');
    if (!tb) return;
    if (!runLog.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="10">Complete a sort in the Arena or a Battle to log it here.</td></tr>';
      return;
    }
    tb.innerHTML = runLog.map((r) => `<tr>
      <td>${escapeHtml(r.time)}</td><td>${escapeHtml(r.source)}</td><td>${escapeHtml(r.algo)}</td>
      <td>${r.size}</td><td>${r.order}</td><td>${fmt(r.comparisons)}</td><td>${fmt(r.swaps)}</td>
      <td>${fmt(r.writes)}</td><td>${fmtMs(r.cpu)}</td><td>${r.anim.toFixed(2)}</td></tr>`).join('');
  }

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  const SECTIONS = ['arena', 'battle', 'analytics', 'learn', 'about'];
  function showSection(id, pushHash = true) {
    if (!SECTIONS.includes(id)) id = 'arena';
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('active', s === id);
    });
    $$('.nav-btn').forEach((b) => {
      const on = b.dataset.nav === id;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    // Leaving the arena/battle pauses running animations
    if (id !== 'arena' && arena.player && arena.player.state === 'running') arena.pauseToggle();
    if (id !== 'battle' && battle.running()) battle.pauseToggle();
    if (pushHash && location.hash !== '#' + id) {
      try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// in some browsers */ }
    }
    // Canvases inside hidden sections need a resize when shown
    requestAnimationFrame(() => {
      if (id === 'arena' && arena.player) arena.player.resize();
      if (id === 'battle') { battle.pA.resize(); battle.pB.resize(); }
      if (id === 'analytics') analytics.drawCharts();
    });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------------
     SECTION 1 — Sorting Arena
     ------------------------------------------------------------------ */
  const arena = {
    player: null,
    algo: 'bubble',
    asc: true,
    pattern: 'random',
    size: 30,
    lastMetricsCmp: -1,

    init() {
      const sel = $('#algoSelect');
      sel.innerHTML = ALGO_KEYS.map((k) => `<option value="${k}">${ALGOS[k].name}${ALGOS[k].intOnly ? ' (integers ≥ 0)' : ''}</option>`).join('');
      sel.value = this.algo;

      this.player = new Player($('#arenaCanvas'), {
        sound: true,
        onUpdate: (p) => this.updateUI(p),
        onNote: (t) => this.narrate(t),
        onDone: (p) => this.onDone(p)
      });
      this.player.speed = +$('#speedRange').value;
      $('#speedOut').textContent = $('#speedRange').value;
      this.newArray();

      sel.addEventListener('change', () => { this.algo = sel.value; this.player.reset(); this.updateHeader(); this.narrate(`Selected <b>${ALGOS[this.algo].name}</b>. Press Start.`, true); this.checkRestriction(); });
      $$('#arena .seg').forEach((b) => b.addEventListener('click', () => {
        this.asc = b.dataset.order === 'asc';
        $$('#arena .seg').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-checked', String(on)); });
        this.player.reset(); this.updateHeader();
      }));
      $('#btnStart').addEventListener('click', () => this.start());
      $('#btnPause').addEventListener('click', () => this.pauseToggle());
      $('#btnStep').addEventListener('click', () => this.step());
      $('#btnReset').addEventListener('click', () => { this.player.reset(); this.narrate('Reset to the original array.', true); });
      $('#btnShuffle').addEventListener('click', () => this.newArray());
      $('#speedRange').addEventListener('input', (e) => { this.player.speed = +e.target.value; $('#speedOut').textContent = e.target.value; });
      $('#sizeRange').addEventListener('input', (e) => { this.size = +e.target.value; $('#sizeOut').textContent = e.target.value; this.newArray(); });
      $('#patternSelect').addEventListener('change', (e) => { this.pattern = e.target.value; this.newArray(); });
      $('#btnApplyCustom').addEventListener('click', () => this.applyCustom());
      $('#customInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.applyCustom(); });

      const tog = $('#soundToggle');
      tog.addEventListener('click', () => {
        Sound.enabled = !Sound.enabled;
        tog.setAttribute('aria-checked', String(Sound.enabled));
        $('.toggle-text', tog).textContent = Sound.enabled ? 'ON' : 'OFF';
        if (Sound.enabled) { Sound.ensure(); Sound.tone(0.6, 'cmp'); }
      });
      $('#volumeRange').addEventListener('input', (e) => { Sound.volume = +e.target.value / 100; });
      Sound.volume = +$('#volumeRange').value / 100;

      this.updateHeader();
    },

    newArray() {
      $('#customInput').classList.remove('invalid');
      this.player.load(generateArray(this.size, this.pattern));
      this.narrate(`New ${$('#patternSelect').selectedOptions[0].text.toLowerCase()} array of ${this.size} elements. Press <b>Start</b>.`, true);
      this.checkRestriction();
    },

    applyCustom() {
      const input = $('#customInput');
      const hint = $('#customHint');
      const res = parseCustom(input.value);
      if (res.error) {
        input.classList.add('invalid');
        hint.textContent = res.error; hint.className = 'hint error';
        return;
      }
      input.classList.remove('invalid');
      this.size = res.arr.length;
      $('#sizeRange').value = clamp(this.size, 5, 100);
      $('#sizeOut').textContent = this.size;
      this.player.load(res.arr);
      const intOk = res.arr.every((v) => Number.isInteger(v) && v >= 0);
      hint.textContent = intOk ? `Loaded ${res.arr.length} values. All algorithms available.` :
        `Loaded ${res.arr.length} values. Contains decimals or negatives — Counting & Radix Sort are unavailable for this array.`;
      hint.className = 'hint ' + (intOk ? 'ok' : 'error');
      this.narrate(`Custom array loaded (${res.arr.length} values). Press <b>Start</b>.`, true);
      this.checkRestriction();
    },

    checkRestriction() {
      const err = validateFor(this.algo, this.player.base);
      if (err) this.narrate('⚠ ' + escapeHtml(err), true);
      return err;
    },

    start() {
      const p = this.player;
      if (p.state === 'running' || p.state === 'finishing') return;
      if (p.state === 'paused' || p.state === 'done') p.reset();   // Restart / Replay from the original array
      if (p.state === 'idle') {
        const err = p.prepare(this.algo, this.asc);
        if (err) { toast(err, 'error'); this.narrate('⚠ ' + escapeHtml(err), true); return; }
      }
      p.start();
    },

    pauseToggle() {
      const p = this.player;
      if (p.state === 'running') { p.pause(); this.narrate('Paused. Press <b>Resume</b> or <b>Step</b>.', true); }
      else if (p.state === 'paused') p.resume();
    },

    step() {
      const p = this.player;
      if (p.state === 'done') p.reset();
      if (p.state === 'idle') {
        const err = p.prepare(this.algo, this.asc);
        if (err) { toast(err, 'error'); this.narrate('⚠ ' + escapeHtml(err), true); return; }
      }
      p.stepOnce();
    },

    narrate(html, raw) {
      $('#narration').innerHTML = raw ? html : escapeHtml(html);
    },

    updateHeader() {
      const a = ALGOS[this.algo];
      $('#stageAlgo').textContent = a.name;
      $('#stageOrder').textContent = this.asc ? 'Ascending' : 'Descending';
      $('#stageComplexity').innerHTML =
        `<span class="chip">Best <b>${a.best}</b></span><span class="chip">Avg <b>${a.avg}</b></span><span class="chip">Worst <b>${a.worst}</b></span><span class="chip">Space <b>${a.space}</b></span>`;
    },

    updateUI(p) {
      const st = p.state;
      const labels = { idle: 'Ready', running: 'Sorting…', paused: 'Paused', finishing: 'Verifying…', done: 'Sorted ✓' };
      const chip = $('#stageState');
      chip.textContent = labels[st] || st;
      chip.dataset.state = st === 'finishing' ? 'running' : st;

      const btnStart = $('#btnStart'), btnPause = $('#btnPause'), btnStep = $('#btnStep');
      btnStart.innerHTML = st === 'paused' ? '<span>↻</span> Restart' : st === 'done' ? '<span>▶</span> Replay' : '<span>▶</span> Start';
      btnStart.disabled = st === 'running' || st === 'finishing';
      btnPause.disabled = !(st === 'running' || st === 'paused');
      btnPause.innerHTML = st === 'paused' ? '<span>▶</span> Resume' : '<span>❚❚</span> Pause';
      btnStep.disabled = st === 'finishing';
      const lockInputs = st === 'running' || st === 'finishing';
      ['#algoSelect', '#sizeRange', '#patternSelect', '#btnApplyCustom'].forEach((s) => { $(s).disabled = lockInputs; });
      $$('#arena .seg').forEach((b) => { b.disabled = lockInputs; });

      $('#mSize').textContent = fmt(p.base.length);
      $('#mSizeSub').textContent = `elements · range ${fmt(Math.min(...p.base))}–${fmt(Math.max(...p.base))}`;
      const cmpEl = $('#mCmp');
      cmpEl.textContent = fmt(p.stats.comparisons);
      $('#mCmpSub').textContent = p.plan ? `of ${fmt(p.plan.comparisons)} total` : 'of — total';
      $('#mSw').textContent = fmt(p.stats.swaps + p.stats.writes);
      $('#mSwSub').textContent = `${fmt(p.stats.swaps)} swaps · ${fmt(p.stats.writes)} writes`;
      $('#mTime').textContent = (p.elapsed / 1000).toFixed(2) + 's';
      $('#mTimeSub').textContent = p.cpu ? `algorithm CPU: ${fmtMs(p.cpu.ms)} ms` : 'algorithm CPU: —';

      const pct = Math.round(p.progress() * 100);
      $('#progressFill').style.width = pct + '%';
      $('#progressText').textContent = pct + '%';
    },

    onDone(p) {
      const burst = $('#completeBurst');
      burst.classList.remove('show'); void burst.offsetWidth; burst.classList.add('show');
      setTimeout(() => burst.classList.remove('show'), 1900);
      Sound.chime();
      const ok = p.plan && p.plan.ok;
      this.narrate(`<b>${ALGOS[p.algoKey].name}</b> finished: ${fmt(p.stats.comparisons)} comparisons, ${fmt(p.stats.swaps)} swaps, ${fmt(p.stats.writes)} writes. ${ok ? 'Output verified ✓' : 'Verification failed ✗'}`, true);
      logRun({
        time: new Date().toLocaleTimeString(), source: 'Arena', algo: ALGOS[p.algoKey].name, size: p.base.length,
        order: p.asc ? 'Asc' : 'Desc', comparisons: p.stats.comparisons, swaps: p.stats.swaps, writes: p.stats.writes,
        cpu: p.cpu ? p.cpu.ms : 0, anim: p.elapsed / 1000
      });
    }
  };

  /* ------------------------------------------------------------------
     SECTION 2 — Algorithm Battle
     ------------------------------------------------------------------ */
  const battle = {
    pA: null, pB: null, base: [], doneCount: 0,

    init() {
      const opts = ALGO_KEYS.map((k) => `<option value="${k}">${ALGOS[k].name}</option>`).join('');
      $('#battleA').innerHTML = opts; $('#battleB').innerHTML = opts;
      $('#battleA').value = 'bubble'; $('#battleB').value = 'quick';

      const mk = (canvasSel, lane) => new Player($(canvasSel), {
        sound: false,
        onUpdate: (p) => this.updateLane(p, lane),
        onDone: () => this.onLaneDone()
      });
      this.pA = mk('#battleCanvasA', 'A');
      this.pB = mk('#battleCanvasB', 'B');
      this.setSpeed(+$('#battleSpeed').value);
      this.newArray();

      $('#battleA').addEventListener('change', () => this.resetBoth());
      $('#battleB').addEventListener('change', () => this.resetBoth());
      $('#battlePattern').addEventListener('change', () => this.newArray());
      $('#battleSize').addEventListener('input', (e) => { $('#battleSizeOut').textContent = e.target.value; this.newArray(); });
      $('#battleSpeed').addEventListener('input', (e) => { $('#battleSpeedOut').textContent = e.target.value; this.setSpeed(+e.target.value); });
      $('#battleStart').addEventListener('click', () => this.start());
      $('#battlePause').addEventListener('click', () => this.pauseToggle());
      $('#battleReset').addEventListener('click', () => this.resetBoth());
      $('#battleNew').addEventListener('click', () => this.newArray());
      this.updateNames();
    },

    setSpeed(s) { this.pA.speed = s; this.pB.speed = s; },
    running() { return this.pA && (this.pA.state === 'running' || this.pB.state === 'running'); },

    newArray() {
      this.base = generateArray(+$('#battleSize').value, $('#battlePattern').value);
      this.pA.load(this.base); this.pB.load(this.base);
      this.afterReset();
    },

    resetBoth() { this.pA.reset(); this.pB.reset(); this.afterReset(); },

    afterReset() {
      this.doneCount = 0;
      $('#battleResult').hidden = true;
      $('#laneA').classList.remove('winner'); $('#laneB').classList.remove('winner');
      this.updateNames();
      this.updateButtons();
    },

    updateNames() {
      $('#laneAName').textContent = ALGOS[$('#battleA').value].name;
      $('#laneBName').textContent = ALGOS[$('#battleB').value].name;
    },

    start() {
      const A = this.pA, B = this.pB;
      if (A.state === 'paused' || B.state === 'paused') { this.pauseToggle(); return; }
      if (A.state === 'done' || B.state === 'done' || A.state !== 'idle' || B.state !== 'idle') this.resetBoth();
      const ka = $('#battleA').value, kb = $('#battleB').value;
      const errA = A.prepare(ka, true), errB = B.prepare(kb, true);
      if (errA || errB) { toast(errA || errB, 'error'); this.resetBoth(); return; }
      this.doneCount = 0;
      $('#battleResult').hidden = true;
      // Start both on the same animation frame
      requestAnimationFrame(() => { A.start(); B.start(); this.updateButtons(); });
    },

    pauseToggle() {
      const A = this.pA, B = this.pB;
      if (this.running()) { A.pause(); B.pause(); }
      else { A.resume(); B.resume(); }
      this.updateButtons();
    },

    updateButtons() {
      const A = this.pA, B = this.pB;
      if (!A || !B) return;
      const anyRunning = this.running();
      const anyPaused = A.state === 'paused' || B.state === 'paused';
      const active = anyRunning || anyPaused || A.state === 'finishing' || B.state === 'finishing';
      $('#battlePause').disabled = !(anyRunning || anyPaused);
      $('#battlePause').innerHTML = anyPaused && !anyRunning ? '<span>▶</span> Resume' : '<span>❚❚</span> Pause';
      $('#battleStart').disabled = anyRunning;
      $('#battleStart').innerHTML = anyPaused && !anyRunning ? '<span>▶</span> Resume' : '<span>⚔</span> Start Battle';
      ['#battleA', '#battleB', '#battlePattern', '#battleSize', '#battleNew'].forEach((s) => { $(s).disabled = active && anyRunning; });
    },

    updateLane(p, lane) {
      const labels = { idle: 'Ready', running: 'Sorting…', paused: 'Paused', finishing: 'Verifying…', done: 'Finished ✓' };
      const chip = $(`#lane${lane}State`);
      chip.textContent = labels[p.state];
      chip.dataset.state = p.state === 'finishing' ? 'running' : p.state;
      $(`#lane${lane}Cmp`).textContent = fmt(p.stats.comparisons);
      $(`#lane${lane}Sw`).textContent = fmt(p.stats.swaps);
      $(`#lane${lane}Wr`).textContent = fmt(p.stats.writes);
      $(`#lane${lane}Time`).textContent = (p.elapsed / 1000).toFixed(2) + 's';
      const pct = Math.round(p.progress() * 100);
      $(`#lane${lane}Prog`).style.width = pct + '%';
      $(`#lane${lane}ProgText`).textContent = pct + '%';
      this.updateButtons();
    },

    onLaneDone() {
      this.doneCount++;
      if (this.doneCount < 2) return;
      Sound.chime();
      this.showResult();
      [['A', this.pA], ['B', this.pB]].forEach(([lane, p]) => logRun({
        time: new Date().toLocaleTimeString(), source: `Battle (${lane})`, algo: ALGOS[p.algoKey].name, size: p.base.length,
        order: 'Asc', comparisons: p.stats.comparisons, swaps: p.stats.swaps, writes: p.stats.writes,
        cpu: p.cpu ? p.cpu.ms : 0, anim: p.elapsed / 1000
      }));
    },

    showResult() {
      const A = this.pA, B = this.pB;
      const nA = ALGOS[A.algoKey].name, nB = ALGOS[B.algoKey].name;
      const opsA = A.stats.comparisons + A.stats.swaps + A.stats.writes;
      const opsB = B.stats.comparisons + B.stats.swaps + B.stats.writes;
      const sameAlgo = A.algoKey === B.algoKey;
      const row = (label, va, vb, fmtFn = fmt, lowerBetter = true) => {
        const winA = lowerBetter ? va < vb : va > vb, winB = lowerBetter ? vb < va : vb > va;
        return `<div class="result-cell"><div class="rc-label">${label}</div>
          <div class="rc-row"><span>A · ${escapeHtml(nA)}</span><span class="${winA ? 'rc-win' : ''}">${fmtFn(va)}</span></div>
          <div class="rc-row"><span>B · ${escapeHtml(nB)}</span><span class="${winB ? 'rc-win' : ''}">${fmtFn(vb)}</span></div></div>`;
      };
      let verdict;
      if (opsA === opsB) verdict = `Both algorithms performed exactly <b>${fmt(opsA)}</b> operations on this array — a tie.`;
      else {
        const winA = opsA < opsB;
        const w = winA ? nA : nB, l = winA ? nB : nA;
        const wo = Math.min(opsA, opsB), lo = Math.max(opsA, opsB);
        const pct = ((1 - wo / lo) * 100).toFixed(1);
        verdict = `<b>${escapeHtml(w)}</b> used <b>${fmt(wo)}</b> total operations (comparisons + swaps + writes) versus <b>${fmt(lo)}</b> for ${escapeHtml(l)} — <b>${pct}% fewer</b> on this input.`;
        $('#lane' + (winA ? 'A' : 'B')).classList.add('winner');
      }
      const cmpNote = A.stats.comparisons !== B.stats.comparisons
        ? `${escapeHtml(A.stats.comparisons < B.stats.comparisons ? nA : nB)} made fewer comparisons (${fmt(Math.min(A.stats.comparisons, B.stats.comparisons))} vs ${fmt(Math.max(A.stats.comparisons, B.stats.comparisons))}).`
        : 'Both made the same number of comparisons.';
      const el = $('#battleResult');
      el.innerHTML = `<h3>Battle Report${sameAlgo ? ' — mirror match' : ''}</h3>
        <p>${verdict}</p><p>${cmpNote}</p>
        <div class="result-grid">
          ${row('Comparisons', A.stats.comparisons, B.stats.comparisons)}
          ${row('Swaps', A.stats.swaps, B.stats.swaps)}
          ${row('Writes', A.stats.writes, B.stats.writes)}
          ${row('Total operations', opsA, opsB)}
          ${row('Measured CPU time (ms)', A.cpu.ms, B.cpu.ms, fmtMs)}
          ${row('Animation time (s)', A.elapsed / 1000, B.elapsed / 1000, (v) => v.toFixed(2))}
        </div>
        <p class="disclaimer">Animation time only reflects how many visual steps each algorithm produced at the chosen speed — it is not proof that one algorithm is computationally faster. Operation counts and the measured CPU time (average of repeated runs without animation) are the meaningful comparison, and results change with input size and pattern. Comparisons and writes also have different real-world costs, and non-comparison sorts (Counting, Radix, Bucket) do work that is not counted as a comparison.</p>`;
      el.hidden = false;
    }
  };

  /* ------------------------------------------------------------------
     SECTION 3 — Analytics Hub
     ------------------------------------------------------------------ */
  const analytics = {
    results: null,
    meta: null,
    asc: true,
    hitboxes: {},

    init() {
      $('#benchSize').addEventListener('input', (e) => { $('#benchSizeOut').textContent = e.target.value; });
      $('#benchSource').addEventListener('change', (e) => {
        const gen = e.target.value === 'generate';
        $('#benchPatternGroup').style.opacity = gen ? 1 : 0.4;
        $('#benchSizeGroup').style.opacity = gen ? 1 : 0.4;
        $('#benchPattern').disabled = !gen; $('#benchSize').disabled = !gen;
      });
      $$('#analytics .seg').forEach((b) => b.addEventListener('click', () => {
        this.asc = b.dataset.border === 'asc';
        $$('#analytics .seg').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-checked', String(on)); });
      }));
      $('#benchRun').addEventListener('click', () => this.run());
      $('#benchExport').addEventListener('click', () => this.exportCSV());
      $('#logClear').addEventListener('click', () => { runLog.length = 0; renderLog(); });

      ['chartCmp', 'chartSw', 'chartTime'].forEach((id) => {
        const c = document.getElementById(id);
        c.addEventListener('mousemove', (e) => this.hover(id, e));
        c.addEventListener('mouseleave', () => { $('#chartTip').hidden = true; });
        new ResizeObserver(() => this.drawCharts()).observe(c.parentElement);
      });
      this.renderTable();
      this.drawCharts();
    },

    run() {
      const btn = $('#benchRun');
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Running…';
      $('#benchMeta').textContent = 'Benchmarking 10 algorithms…';
      // Let the UI paint before the CPU-bound work
      setTimeout(() => {
        try {
          let input, label;
          if ($('#benchSource').value === 'arena') {
            input = arena.player.base.slice();
            label = `current Arena array (${input.length} elements)`;
          } else {
            const size = +$('#benchSize').value, pattern = $('#benchPattern').value;
            input = generateArray(size, pattern);
            label = `${$('#benchPattern').selectedOptions[0].text.toLowerCase()} array of ${size} elements`;
          }
          const asc = this.asc;
          const results = ALGO_KEYS.map((k) => {
            const err = validateFor(k, input);
            if (err) return { key: k, skipped: err };
            return { key: k, ...measureCPU(k, input, asc) };
          });
          this.results = results;
          this.meta = { label, asc, size: input.length, when: new Date() };
          const skipped = results.filter((r) => r.skipped).length;
          $('#benchMeta').innerHTML = `Benchmarked on a ${escapeHtml(label)}, ${asc ? 'ascending' : 'descending'} · ${this.meta.when.toLocaleTimeString()}` +
            (skipped ? ` · ${skipped} algorithm(s) skipped (need whole numbers ≥ 0)` : '') +
            ` · all outputs verified ${results.every((r) => r.skipped || r.ok) ? '✓' : '✗'}`;
          $('#benchExport').disabled = false;
          this.renderTable();
          this.drawCharts();
          toast('Benchmark complete', 'success');
        } catch (err) {
          console.error(err);
          toast('Benchmark failed: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<span>⚡</span> Run Benchmark';
        }
      }, 30);
    },

    renderTable() {
      const tb = $('#benchTable tbody');
      const res = this.results;
      const valid = res ? res.filter((r) => !r.skipped) : [];
      const minOf = (f) => valid.length ? Math.min(...valid.map(f)) : null;
      const minC = minOf((r) => r.comparisons), minS = minOf((r) => r.swaps), minW = minOf((r) => r.writes), minT = minOf((r) => r.ms);
      tb.innerHTML = ALGO_KEYS.map((k) => {
        const a = ALGOS[k];
        const r = res ? res.find((x) => x.key === k) : null;
        let measured;
        if (!r) measured = '<td class="skip">—</td><td class="skip">—</td><td class="skip">—</td><td class="skip">—</td>';
        else if (r.skipped) measured = `<td class="skip" colspan="4" title="${escapeHtml(r.skipped)}">skipped — needs integers ≥ 0</td>`;
        else measured = `<td class="${r.comparisons === minC ? 'best' : ''}">${fmt(r.comparisons)}</td>
          <td class="${r.swaps === minS ? 'best' : ''}">${fmt(r.swaps)}</td>
          <td class="${r.writes === minW ? 'best' : ''}">${fmt(r.writes)}</td>
          <td class="${r.ms === minT ? 'best' : ''}">${fmtMs(r.ms)}</td>`;
        const ver = !r ? '—' : r.skipped ? '—' : r.ok ? '✓' : '✗';
        return `<tr><td>${a.name}</td>${measured}<td>${a.best}</td><td>${a.avg}</td><td>${a.worst}</td><td>${a.space}</td><td>${a.stable ? 'Yes' : 'No'}</td><td>${ver}</td></tr>`;
      }).join('');
    },

    drawCharts() {
      const sec = $('#analytics');
      if (!sec || !sec.classList.contains('active')) return;
      const res = this.results;
      const rows = (field) => ALGO_KEYS.map((k) => {
        const r = res ? res.find((x) => x.key === k) : null;
        return { key: k, name: ALGOS[k].name, value: r && !r.skipped ? field(r) : null, skipped: r && r.skipped };
      });
      this.drawBar('chartCmp', rows((r) => r.comparisons), COLORS.amber, fmt, 'comparisons');
      this.drawBar('chartSw', rows((r) => r.swaps + r.writes), COLORS.purple, fmt, 'swaps + writes');
      this.drawBar('chartTime', rows((r) => r.ms), COLORS.blue, (v) => fmtMs(v) + ' ms', 'average CPU time');
    },

    drawBar(id, rows, color, fmtFn, unit) {
      const canvas = document.getElementById(id);
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, rect.width), H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const hits = [];
      this.hitboxes[id] = { hits, unit, fmtFn };

      const labelW = Math.min(118, W * 0.36);
      const valueW = 64;
      const top = 4, rowH = (H - top - 4) / rows.length;
      const barH = Math.max(6, Math.min(18, rowH - 8));
      const plotX = labelW + 6, plotW = Math.max(10, W - plotX - valueW);
      const max = Math.max(1e-9, ...rows.map((r) => r.value || 0));

      ctx.font = '12px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.textBaseline = 'middle';
      rows.forEach((r, i) => {
        const cy = top + rowH * i + rowH / 2;
        ctx.fillStyle = COLORS.text2;
        ctx.textAlign = 'right';
        ctx.fillText(r.name.replace(' Sort', ''), labelW, cy);
        // track
        ctx.fillStyle = 'rgba(139,92,246,0.08)';
        roundRectH(ctx, plotX, cy - barH / 2, plotW, barH, 4);
        ctx.fill();
        if (r.value === null) {
          ctx.fillStyle = COLORS.muted;
          ctx.textAlign = 'left';
          ctx.fillText(r.skipped ? 'n/a (integers only)' : '—', plotX + 6, cy);
          return;
        }
        const w = Math.max(2, (r.value / max) * plotW);
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 8;
        roundRectH(ctx, plotX, cy - barH / 2, w, barH, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'left';
        ctx.font = '600 11.5px "Cascadia Code", Consolas, monospace';
        const txt = fmtFn(r.value);
        const tx = plotX + w + 6;
        ctx.fillText(txt, Math.min(tx, W - ctx.measureText(txt).width - 2), cy);
        ctx.font = '12px "Segoe UI", Roboto, Arial, sans-serif';
        hits.push({ y0: top + rowH * i, y1: top + rowH * (i + 1), row: r });
      });
      if (!this.results) {
        ctx.fillStyle = 'rgba(9,7,19,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = COLORS.text2;
        ctx.textAlign = 'center';
        ctx.font = '13px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText('Run a benchmark to populate this chart', W / 2, H / 2);
      }
    },

    hover(id, e) {
      const hb = this.hitboxes[id];
      const tip = $('#chartTip');
      if (!hb) { tip.hidden = true; return; }
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = hb.hits.find((q) => y >= q.y0 && y < q.y1);
      if (!h) { tip.hidden = true; return; }
      tip.innerHTML = `${escapeHtml(h.row.name)}<b>${escapeHtml(hb.fmtFn(h.row.value))}</b><span style="color:#8F87B8">${hb.unit}</span>`;
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = clamp(e.clientX + 14, 8, window.innerWidth - tw - 8) + 'px';
      tip.style.top = clamp(e.clientY - th - 10, 8, window.innerHeight - th - 8) + 'px';
    },

    exportCSV() {
      if (!this.results) return;
      const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
      const lines = [];
      lines.push(['SORTNEXUS AI benchmark'].map(q).join(','));
      lines.push([q('Input'), q(this.meta.label)].join(','));
      lines.push([q('Order'), q(this.meta.asc ? 'Ascending' : 'Descending')].join(','));
      lines.push([q('Generated'), q(this.meta.when.toISOString())].join(','));
      lines.push('');
      lines.push(['Algorithm', 'Comparisons', 'Swaps', 'Writes', 'Total operations', 'CPU avg (ms)', 'Runs averaged', 'Best case', 'Average case', 'Worst case', 'Space', 'Stable', 'Verified sorted', 'Note'].map(q).join(','));
      this.results.forEach((r) => {
        const a = ALGOS[r.key];
        if (r.skipped) {
          lines.push([a.name, '', '', '', '', '', '', a.best, a.avg, a.worst, a.space, a.stable ? 'Yes' : 'No', '', r.skipped].map(q).join(','));
        } else {
          lines.push([a.name, r.comparisons, r.swaps, r.writes, r.comparisons + r.swaps + r.writes, r.ms.toFixed(5), r.reps, a.best, a.avg, a.worst, a.space, a.stable ? 'Yes' : 'No', r.ok ? 'Yes' : 'No', ''].map(q).join(','));
        }
      });
      if (runLog.length) {
        lines.push('');
        lines.push(['Run log'].map(q).join(','));
        lines.push(['Time', 'Source', 'Algorithm', 'Size', 'Order', 'Comparisons', 'Swaps', 'Writes', 'CPU (ms)', 'Animation (s)'].map(q).join(','));
        runLog.forEach((r) => lines.push([r.time, r.source, r.algo, r.size, r.order, r.comparisons, r.swaps, r.writes, r.cpu.toFixed(5), r.anim.toFixed(2)].map(q).join(',')));
      }
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sortnexus-benchmark-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('CSV exported', 'success');
    }
  };

  function roundRectH(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  /* ------------------------------------------------------------------
     SECTION 4 — Learning Center
     ------------------------------------------------------------------ */
  const learn = {
    current: 'bubble',
    init() {
      const list = $('#learnList');
      list.innerHTML = ALGO_KEYS.map((k, i) =>
        `<button class="learn-tab${k === this.current ? ' active' : ''}" role="tab" aria-selected="${k === this.current}" data-key="${k}"><span class="num">${String(i + 1).padStart(2, '0')}</span>${ALGOS[k].name}</button>`).join('');
      list.addEventListener('click', (e) => {
        const b = e.target.closest('.learn-tab');
        if (b) this.show(b.dataset.key);
      });
      list.addEventListener('keydown', (e) => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const i = ALGO_KEYS.indexOf(this.current);
        const next = ALGO_KEYS[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + ALGO_KEYS.length) % ALGO_KEYS.length];
        this.show(next);
        $(`.learn-tab[data-key="${next}"]`).focus();
      });
      this.show(this.current);
    },
    show(key) {
      this.current = key;
      $$('.learn-tab').forEach((b) => { const on = b.dataset.key === key; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
      const a = ALGOS[key];
      const li = (arr) => arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
      const d = $('#learnDetail');
      d.innerHTML = `
        <div class="ld-top">
          <div><h3>${a.name}</h3><div class="ld-type">${a.type}</div></div>
          <button class="btn btn-primary" data-try="${key}"><span>▶</span> Visualize in Arena</button>
        </div>
        <p class="ld-summary">${escapeHtml(a.summary)}</p>
        <div class="cx-grid">
          <div class="cx c-best"><span>Best</span><b>${a.best}</b></div>
          <div class="cx c-avg"><span>Average</span><b>${a.avg}</b></div>
          <div class="cx c-worst"><span>Worst</span><b>${a.worst}</b></div>
          <div class="cx c-space"><span>Space</span><b>${a.space}</b></div>
          <div class="cx"><span>Stable</span><b>${a.stable ? 'Yes' : 'No'}</b></div>
        </div>
        ${a.restriction ? `<div class="restriction">⚠ ${escapeHtml(a.restriction)}</div>` : ''}
        <div class="ld-sec"><h4>How it works</h4><ol>${li(a.how)}</ol></div>
        <div class="ld-sec"><h4>Step-by-step example</h4><ol class="example">${li(a.example)}</ol></div>
        <div class="ld-sec"><h4>Pseudocode</h4><pre class="pseudo">${a.pseudo}</pre></div>
        <div class="ld-sec"><h4>Advantages &amp; disadvantages</h4>
          <div class="pros-cons">
            <div class="pc pro"><h5>Advantages</h5><ul>${li(a.pros)}</ul></div>
            <div class="pc con"><h5>Disadvantages</h5><ul>${li(a.cons)}</ul></div>
          </div>
        </div>
        <div class="ld-sec"><h4>Real-world applications</h4><ul>${li(a.uses)}</ul></div>`;
      d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
      $('[data-try]', d).addEventListener('click', () => {
        arena.algo = key;
        $('#algoSelect').value = key;
        arena.player.reset();
        arena.updateHeader();
        showSection('arena');
        if (!arena.checkRestriction()) arena.narrate(`Selected <b>${a.name}</b>. Press Start.`, true);
      });
    }
  };

  /* ------------------------------------------------------------------
     SECTION 5 — About (editable team)
     ------------------------------------------------------------------ */
  const DEFAULT_TEAM = [
    { name: 'Team Member 1', role: 'Project Lead & Algorithms' },
    { name: 'Team Member 2', role: 'UI / UX Design' },
    { name: 'Team Member 3', role: 'Front-end Development' },
    { name: 'Team Member 4', role: 'Testing & Documentation' }
  ];
  const team = {
    list: [],
    init() {
      const saved = storageGet('sortnexus.team', null);
      this.list = Array.isArray(saved) && saved.length ? saved : DEFAULT_TEAM.map((m) => ({ ...m }));
      this.render();
      $('#teamAdd').addEventListener('click', () => {
        this.list.push({ name: `Team Member ${this.list.length + 1}`, role: 'Role' });
        this.save(); this.render();
        const last = $$('#teamGrid .m-name').pop();
        if (last) { last.focus(); selectAll(last); }
      });
      $('#teamResetBtn').addEventListener('click', () => {
        this.list = DEFAULT_TEAM.map((m) => ({ ...m }));
        this.save(); this.render(); toast('Team list reset');
      });
      $('#teamGrid').addEventListener('input', (e) => {
        const card = e.target.closest('.member');
        if (!card) return;
        const i = +card.dataset.i;
        if (e.target.classList.contains('m-name')) {
          this.list[i].name = e.target.textContent.trim();
          $('.avatar', card).textContent = initials(this.list[i].name);
        } else if (e.target.classList.contains('m-role')) this.list[i].role = e.target.textContent.trim();
        this.save();
      });
      $('#teamGrid').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.isContentEditable) { e.preventDefault(); e.target.blur(); }
      });
      $('#teamGrid').addEventListener('click', (e) => {
        const del = e.target.closest('.m-del');
        if (!del) return;
        const i = +del.closest('.member').dataset.i;
        this.list.splice(i, 1);
        this.save(); this.render();
      });
    },
    render() {
      $('#teamGrid').innerHTML = this.list.map((m, i) => `
        <div class="member" data-i="${i}">
          <button class="m-del" title="Remove member" aria-label="Remove ${escapeHtml(m.name)}">✕</button>
          <div class="avatar" aria-hidden="true">${escapeHtml(initials(m.name))}</div>
          <div class="m-name" contenteditable="true" spellcheck="false" role="textbox" aria-label="Member name">${escapeHtml(m.name)}</div>
          <div class="m-role" contenteditable="true" spellcheck="false" role="textbox" aria-label="Member role">${escapeHtml(m.role)}</div>
        </div>`).join('');
    },
    save() { storageSet('sortnexus.team', this.list); }
  };
  function initials(name) {
    const p = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function selectAll(el) {
    const range = document.createRange(); range.selectNodeContents(el);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }

  /* ------------------------------------------------------------------
     Background particles
     ------------------------------------------------------------------ */
  const particles = {
    canvas: null, ctx: null, list: [], raf: 0, w: 0, h: 0,
    init() {
      this.canvas = $('#particles');
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(this.raf); else this.loop();
      });
      if (reducedMotionQuery.addEventListener) reducedMotionQuery.addEventListener('change', () => this.loop());
      this.loop();
    },
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(clamp((this.w * this.h) / 22000, 25, 75));
      const cols = [COLORS.pink, COLORS.purple, COLORS.blue, COLORS.green];
      this.list = Array.from({ length: count }, () => ({
        x: Math.random() * this.w, y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25 - 0.08,
        r: Math.random() * 1.8 + 0.6, c: cols[randInt(0, cols.length - 1)], ph: Math.random() * Math.PI * 2
      }));
      this.drawFrame(0);
    },
    loop() {
      cancelAnimationFrame(this.raf);
      if (reducedMotion()) { this.drawFrame(0); return; }
      const step = (t) => { this.drawFrame(t); this.raf = requestAnimationFrame(step); };
      this.raf = requestAnimationFrame(step);
    },
    drawFrame(t) {
      const ctx = this.ctx, L = this.list;
      ctx.clearRect(0, 0, this.w, this.h);
      const move = !reducedMotion();
      for (const p of L) {
        if (move) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = this.w + 10; if (p.x > this.w + 10) p.x = -10;
          if (p.y < -10) p.y = this.h + 10; if (p.y > this.h + 10) p.y = -10;
        }
      }
      ctx.lineWidth = 0.6;
      for (let i = 0; i < L.length; i++) {
        for (let j = i + 1; j < L.length; j++) {
          const dx = L[i].x - L[j].x, dy = L[i].y - L[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) {
            ctx.strokeStyle = `rgba(139,92,246,${0.14 * (1 - Math.sqrt(d2) / 120)})`;
            ctx.beginPath(); ctx.moveTo(L[i].x, L[i].y); ctx.lineTo(L[j].x, L[j].y); ctx.stroke();
          }
        }
      }
      for (const p of L) {
        const a = 0.45 + 0.35 * Math.sin(t / 900 + p.ph);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  };

  /* ------------------------------------------------------------------
     Keyboard shortcuts (Arena)
     ------------------------------------------------------------------ */
  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!$('#arena').classList.contains('active')) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' && tag !== 'button') {
        e.preventDefault();
        const p = arena.player;
        if (p.state === 'running' || p.state === 'paused') arena.pauseToggle(); else arena.start();
      } else if (e.key === 'ArrowRight') { e.preventDefault(); arena.step(); }
      else if (e.key === 'r' || e.key === 'R') { arena.player.reset(); arena.narrate('Reset to the original array.', true); }
      else if ((e.key === 's' || e.key === 'S') && arena.player.state !== 'running') arena.newArray();
    });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    document.documentElement.classList.add('js-ready');
    document.body.classList.add('js-ready');

    particles.init();
    arena.init();
    battle.init();
    analytics.init();
    learn.init();
    team.init();
    initShortcuts();

    $$('[data-nav]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); showSection(el.dataset.nav); }));
    window.addEventListener('hashchange', () => showSection(location.hash.slice(1), false));
    showSection((location.hash || '#arena').slice(1), false);

    const bootEl = $('#boot');
    const texts = ['Initializing visualization engine…', 'Loading 10 sorting algorithms…', 'Calibrating neon flux…', 'Ready.'];
    let t = 0;
    const bt = $('#bootText');
    const iv = setInterval(() => { t++; if (bt && texts[t]) bt.textContent = texts[t]; }, 280);
    setTimeout(() => { clearInterval(iv); bootEl.classList.add('done'); }, reducedMotion() ? 50 : 1200);
  }

  // Expose a tiny API for testing in the console (window.SORTNEXUS)
  window.SORTNEXUS = { ALGOS, Recorder, runRecorded, measureCPU, validateFor, generateArray };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
