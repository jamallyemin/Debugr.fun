// Chapter 12: The standard library (re, itertools, functools, collections, numbers, paths, async).
(function (root) {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("./lessons.js") : root.Lessons;

  L.add({ id: 12, name: "The standard library", sub: "re, itertools, functools, collections, async", lessons: [
    { id: "12.1", title: "Patterns with re", bug: "Regular expressions describe the shape of text, so you can find or check it in one line.",
      read: [
        "The <code>re</code> module finds text by <b>pattern</b>. <code>\\d</code> is a digit, <code>\\w</code> a letter or digit, <code>+</code> means \"one or more\", <code>*</code> \"zero or more\", <code>?</code> \"optional\".",
        "<code>re.search(p, s)</code> finds the first match (or <code>None</code>). <code>re.findall(p, s)</code> returns a list of all matches. <code>re.sub(p, new, s)</code> replaces matches.",
        "Round brackets make a <b>group</b> you can pull out: <code>m.group(1)</code>. Write patterns as raw strings: <code>r\"\\d+\"</code>.",
      ],
      try: { code: 'import re\n\ntext = "call 555-1234 or 555-9876"\nprint(re.findall(r"\\d+-\\d+", text))\nm = re.search(r"(\\d+)-(\\d+)", text)\nprint(m.group(1), m.group(2))\nprint(re.sub(r"\\d", "#", text))', note: "Search for a word that is not in the text. What do you get back?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "import re\nprint(re.findall(r'\\d+', 'a1b22c333'))", why: "Each run of digits is one match." },
        { type: "predict", prompt: "What will this show?", code: "import re\nprint(re.sub(r'\\s+', ' ', 'a   b    c'))", why: "Any run of spaces becomes one space." },
        { type: "write", prompt: "Write <code>numbers(text)</code> that returns a list of all whole numbers in the text, as <b>ints</b>.", start: "", solution: "import re\n\ndef numbers(text):\n    return [int(n) for n in re.findall(r'\\d+', text)]", tests: [["numbers('a1b22c333')", "[1, 22, 333]"], ["numbers('none')", "[]"]], must: /re\./, why: "findall gives strings, so convert each with int()." },
        { type: "write", prompt: "Write <code>is_code(s)</code> that returns <b>True</b> only if <code>s</code> is exactly <b>two capital letters, a dash and three digits</b> (like AB-123).", start: "", solution: "import re\n\ndef is_code(s):\n    return re.fullmatch(r'[A-Z]{2}-\\d{3}', s) is not None", tests: [["is_code('AB-123')", "True"], ["is_code('ab-123')", "False"], ["is_code('AB-1234')", "False"], ["is_code('XAB-123')", "False"]], must: /re\./, why: "fullmatch must match the whole string, not just part of it." },
      ] },
    { id: "12.2", title: "itertools", bug: "Ready-made tools for looping: combinations, chains, groups and endless counters.",
      read: [
        "<code>itertools</code> builds loops without writing them. <code>chain(a, b)</code> walks several lists as one. <code>combinations(items, 2)</code> gives every pair without repeats. <code>permutations</code> cares about order. <code>product</code> is every combination of choices.",
        "<code>accumulate</code> gives running totals. <code>islice(it, n)</code> takes the first n of anything, even an endless iterator. <code>groupby</code> groups <b>neighbouring</b> equal items, so sort first.",
        "Most return <b>iterators</b>, so wrap them in <code>list()</code> to see all the results.",
      ],
      try: { code: 'from itertools import chain, combinations, product, accumulate, islice, count\n\nprint(list(chain([1, 2], [3])))\nprint(list(combinations("abc", 2)))\nprint(list(product([0, 1], repeat=2)))\nprint(list(accumulate([1, 2, 3, 4])))\nprint(list(islice(count(10), 3)))', note: "Try permutations('abc', 2) from itertools." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "from itertools import combinations\nprint(len(list(combinations(range(5), 2))))", why: "5 choose 2 is 10 pairs." },
        { type: "predict", prompt: "What will this show?", code: "from itertools import accumulate\nprint(list(accumulate([3, 1, 4])))", why: "Running total: 3, 3+1, 3+1+4." },
        { type: "write", prompt: "Write <code>pairs(items)</code> that returns a list of every <b>pair of different items</b> (no repeats, order inside a pair stays as in the list).", start: "", solution: "from itertools import combinations\n\ndef pairs(items):\n    return list(combinations(items, 2))", tests: [["pairs([1, 2, 3])", "[(1, 2), (1, 3), (2, 3)]"], ["pairs([1])", "[]"]], must: /combinations/, why: "combinations(items, 2) does exactly that." },
        { type: "write", prompt: "Write <code>group_sizes(text)</code> that returns a list of the lengths of runs of equal neighbouring letters. <code>'aaabcc'</code> gives <b>[3, 1, 2]</b>. Use <code>groupby</code>.", start: "", solution: "from itertools import groupby\n\ndef group_sizes(text):\n    return [len(list(g)) for _, g in groupby(text)]", tests: [["group_sizes('aaabcc')", "[3, 1, 2]"], ["group_sizes('')", "[]"], ["group_sizes('abab')", "[1, 1, 1, 1]"]], must: /groupby/, why: "groupby gives (key, group) for each run. Count each group." },
      ] },
    { id: "12.3", title: "functools", bug: "Cache slow results, fix some arguments in advance, and fold a list into one value.",
      read: [
        "<code>functools.lru_cache</code> is a decorator that <b>remembers results</b>. Calling the function again with the same arguments returns the saved answer instead of working it out again. It makes recursion like Fibonacci fast.",
        "<code>partial(f, 2)</code> makes a new function with some arguments already filled in. <code>reduce(f, items)</code> folds a list into one value by applying f again and again.",
        "<code>@wraps(f)</code> inside your own decorators keeps the original name and docstring.",
      ],
      try: { code: 'from functools import lru_cache, partial, reduce\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(60))\n\ndouble = partial(pow, 2)   # pow(2, x)\nprint(double(5))\n\nprint(reduce(lambda a, b: a * b, [1, 2, 3, 4]))', note: "Remove @lru_cache and try fib(32). Notice it gets slow." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "from functools import reduce\nprint(reduce(lambda a, b: a + b, [1, 2, 3, 4], 10))", why: "Start at 10, then add 1, 2, 3 and 4." },
        { type: "predict", prompt: "What will this show?", code: "from functools import partial\n\ndef power(base, exp):\n    return base ** exp\n\nsquare = partial(power, exp=2)\nprint(square(7))", why: "exp is already fixed to 2." },
        { type: "write", prompt: "Write <code>product(nums)</code> that multiplies all numbers in a list using <code>reduce</code>. An empty list gives <b>1</b>.", start: "", solution: "from functools import reduce\n\ndef product(nums):\n    return reduce(lambda a, b: a * b, nums, 1)", tests: [["product([2, 3, 4])", "24"], ["product([])", "1"]], must: /reduce/, why: "The starting value 1 covers the empty list." },
        { type: "write", prompt: "Write a cached function <code>paths(r, c)</code>: the number of ways to walk from the top left of a grid to a square <code>r</code> down and <code>c</code> right, moving only down or right. <code>paths(0, 0)</code> is 1. Use <code>lru_cache</code>.", start: "", solution: "from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef paths(r, c):\n    if r == 0 or c == 0:\n        return 1\n    return paths(r - 1, c) + paths(r, c - 1)", tests: [["paths(2, 2)", "6"], ["paths(0, 5)", "1"], ["paths(16, 16)", "601080390"]], must: /lru_cache/, why: "Without the cache, paths(16, 16) would take far too long." },
      ] },
    { id: "12.4", title: "Handy containers", bug: "deque, defaultdict, Counter, heapq and bisect each solve one job perfectly.",
      read: [
        "<code>deque</code> is a list that is fast at <b>both ends</b>: <code>appendleft</code> and <code>popleft</code>. <code>defaultdict(list)</code> creates a missing value for you. <code>d.setdefault(k, [])</code> does that for a plain dict.",
        "<code>heapq</code> keeps the <b>smallest item</b> easy to get: <code>heappush</code>, <code>heappop</code>, and <code>nsmallest</code> / <code>nlargest</code>.",
        "<code>bisect</code> searches a <b>sorted</b> list quickly: <code>bisect_left(items, x)</code> is where x belongs.",
      ],
      try: { code: 'from collections import deque, defaultdict\nimport heapq, bisect\n\nq = deque([1, 2, 3])\nq.appendleft(0)\nprint(q.popleft(), list(q))\n\ngroups = defaultdict(list)\nfor w in ["apple", "avocado", "bean"]:\n    groups[w[0]].append(w)\nprint(dict(groups))\n\nh = []\nfor n in [5, 1, 4]:\n    heapq.heappush(h, n)\nprint(heapq.heappop(h))\n\nprint(bisect.bisect_left([10, 20, 30], 25))', note: "Print heapq.nlargest(2, [5, 1, 4, 9])." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "import heapq\nh = [4, 1, 7]\nheapq.heapify(h)\nprint(heapq.heappop(h), heapq.heappop(h))", why: "A heap always gives the smallest item first." },
        { type: "predict", prompt: "What will this show?", code: "import bisect\nprint(bisect.bisect_left([1, 3, 5, 7], 5))", why: "5 sits at index 2, and that is where it would be inserted." },
        { type: "write", prompt: "Write <code>group_by_length(words)</code> that returns a <b>dict</b> mapping each length to the list of words of that length (keep input order). Use <code>defaultdict</code> or <code>setdefault</code>.", start: "", solution: "from collections import defaultdict\n\ndef group_by_length(words):\n    out = defaultdict(list)\n    for w in words:\n        out[len(w)].append(w)\n    return dict(out)", tests: [["group_by_length(['a', 'bb', 'c', 'dd'])", "{1: ['a', 'c'], 2: ['bb', 'dd']}"], ["group_by_length([])", "{}"]], why: "The missing key is created as an empty list the first time." },
        { type: "write", prompt: "Write <code>top3(nums)</code> that returns the <b>three largest</b> numbers, biggest first, using <code>heapq</code>.", start: "", solution: "import heapq\n\ndef top3(nums):\n    return heapq.nlargest(3, nums)", tests: [["top3([5, 1, 9, 3, 7])", "[9, 7, 5]"], ["top3([2, 1])", "[2, 1]"]], must: /heapq/, why: "nlargest does the sorting work for you." },
      ] },
    { id: "12.5", title: "Exact numbers and statistics", bug: "Decimal and Fraction avoid float surprises. statistics does the usual averages.",
      read: [
        "Floats are slightly off for many decimals: <code>0.1 + 0.2</code> is not exactly <code>0.3</code>. For money use <code>Decimal</code> made from <b>strings</b>: <code>Decimal(\"0.1\")</code>. For exact ratios use <code>Fraction(1, 3)</code>.",
        "<code>statistics</code> has <code>mean</code>, <code>median</code>, <code>mode</code>, and <code>stdev</code>.",
        "<code>divmod(a, b)</code> gives the quotient and the remainder together. <code>round(x, 2)</code> rounds, and <code>abs</code> is the distance from zero.",
      ],
      try: { code: 'from decimal import Decimal\nfrom fractions import Fraction\nimport statistics\n\nprint(0.1 + 0.2 == 0.3)\nprint(Decimal("0.1") + Decimal("0.2") == Decimal("0.3"))\nprint(Fraction(1, 3) + Fraction(1, 6))\nprint(statistics.mean([1, 2, 3, 10]), statistics.median([1, 2, 3, 10]))\nprint(divmod(17, 5))', note: "Try Decimal(0.1) without quotes and look at the long result." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "from fractions import Fraction\nprint(Fraction(1, 2) + Fraction(1, 4))", why: "Fractions stay exact: 3/4." },
        { type: "predict", prompt: "What will this show?", code: "print(divmod(47, 10))", why: "47 is 4 tens with 7 left over." },
        { type: "write", prompt: "Write <code>to_hms(seconds)</code> that returns <code>(hours, minutes, seconds)</code> as a tuple. Use <code>divmod</code>.", start: "", solution: "def to_hms(seconds):\n    m, s = divmod(seconds, 60)\n    h, m = divmod(m, 60)\n    return (h, m, s)", tests: [["to_hms(3661)", "(1, 1, 1)"], ["to_hms(59)", "(0, 0, 59)"], ["to_hms(7200)", "(2, 0, 0)"]], must: /divmod/, why: "Two divmods: seconds into minutes, then minutes into hours." },
        { type: "write", prompt: "Write <code>total(prices)</code> that takes a list of <b>strings</b> like <code>'0.10'</code> and returns their exact sum as a <b>Decimal</b>.", start: "", solution: "from decimal import Decimal\n\ndef total(prices):\n    return sum((Decimal(p) for p in prices), Decimal('0'))", tests: [["total(['0.10', '0.20'])", "Decimal('0.30')"], ["total([])", "Decimal('0')"]], must: /Decimal/, why: "Decimal from strings keeps 0.10 + 0.20 exactly 0.30." },
      ] },
    { id: "12.6", title: "Paths and the system", bug: "os.path and pathlib work with file names as text. sys tells you about Python itself.",
      read: [
        "File names have parts. <code>os.path.join(\"a\", \"b.txt\")</code> joins them correctly, <code>os.path.splitext</code> splits the extension, <code>os.path.basename</code> gives the last part.",
        "<code>pathlib.PurePosixPath</code> does the same in a friendlier way: <code>.name</code>, <code>.suffix</code>, <code>.stem</code>, <code>.parent</code>, and <code>/</code> to join parts.",
        "<code>sys.argv</code> holds command line words, <code>sys.exit()</code> stops the program and <code>sys.version_info</code> tells the Python version. Reading real files works in the desktop version of Python, but the browser version has no files of yours.",
      ],
      try: { code: 'import os.path\nfrom pathlib import PurePosixPath\nimport sys\n\np = PurePosixPath("/home/ada/notes.txt")\nprint(p.name, p.stem, p.suffix, p.parent)\nprint(p.parent / "todo.md")\nprint(os.path.splitext("photo.final.png"))\nprint(os.path.join("a", "b", "c.txt"))\nprint(sys.version_info.major)', note: "What does p.with_suffix('.md') give?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "from pathlib import PurePosixPath\nprint(PurePosixPath('/a/b/report.pdf').suffix)", why: "suffix is the extension including the dot." },
        { type: "predict", prompt: "What will this show?", code: "import os.path\nprint(os.path.splitext('archive.tar.gz'))", why: "Only the last extension is split off." },
        { type: "write", prompt: "Write <code>extension(name)</code> returning the extension <b>without the dot</b>, in lowercase. <code>'Photo.PNG'</code> gives <b>'png'</b>, and no extension gives an empty string.", start: "", solution: "from pathlib import PurePosixPath\n\ndef extension(name):\n    return PurePosixPath(name).suffix.lstrip('.').lower()", tests: [["extension('Photo.PNG')", "'png'"], ["extension('README')", "''"], ["extension('a.b.txt')", "'txt'"]], why: "suffix is '' when there is none, so lstrip is safe." },
        { type: "write", prompt: "Write <code>rename(path, new_stem)</code> that changes only the <b>file name without extension</b>, keeping the folder and extension. <code>rename('/x/old.txt', 'new')</code> gives <b>'/x/new.txt'</b> (as a string).", start: "", solution: "from pathlib import PurePosixPath\n\ndef rename(path, new_stem):\n    p = PurePosixPath(path)\n    return str(p.with_name(new_stem + p.suffix))", tests: [["rename('/x/old.txt', 'new')", "'/x/new.txt'"], ["rename('a.py', 'b')", "'b.py'"]], why: "with_name swaps the last part. Add the old suffix back." },
      ] },
    { id: "12.7", title: "async and await", bug: "async functions can pause and let others run. Here you drive one by hand to see how it works.",
      read: [
        "An <b>async function</b> (<code>async def</code>) does not run when called. It gives you a <b>coroutine</b>, a paused job. Inside, <code>await</code> says \"pause here until this other job is done\".",
        "In a normal Python program you start the engine with <code>asyncio.run(main())</code> and many jobs share one thread, great for waiting on the network. <b>This browser version cannot run that engine</b>, so here you drive a coroutine yourself with <code>coro.send(None)</code>, which is what the engine does underneath.",
        "A coroutine that finishes raises <code>StopIteration</code>, and its <code>.value</code> is the return value. Learn the idea here, then use <code>asyncio.run</code> in a real script.",
      ],
      try: { code: 'async def add(a, b):\n    return a + b\n\nasync def main():\n    x = await add(1, 2)\n    y = await add(x, 10)\n    return y\n\ndef run(coro):\n    try:\n        coro.send(None)\n    except StopIteration as done:\n        return done.value\n\nprint(run(main()))', note: "Call main() without run(). Python shows a coroutine object, not 13." },
      ex: [
        { type: "choice", prompt: "What does <code>async def f(): ...</code> give you when you call <code>f()</code>?", options: ["The return value at once", "A coroutine object that has not run yet", "A thread", "An error"], answer: 1, why: "Calling it only creates the paused job. Something must run it." },
        { type: "predict", prompt: "What will this show?", code: "async def f():\n    return 'done'\n\ndef run(c):\n    try:\n        c.send(None)\n    except StopIteration as e:\n        return e.value\n\nprint(run(f()))", why: "The finished coroutine hands back its return value through StopIteration." },
        { type: "fix", prompt: "The result shows a coroutine object instead of <b>6</b>. Make it print 6.", code: "async def double(n):\n    return n * 2\n\nasync def main():\n    x = double(3)\n    return x\n\ndef run(c):\n    try:\n        c.send(None)\n    except StopIteration as e:\n        return e.value\n\nprint(run(main()))", solution: "async def double(n):\n    return n * 2\n\nasync def main():\n    x = await double(3)\n    return x\n\ndef run(c):\n    try:\n        c.send(None)\n    except StopIteration as e:\n        return e.value\n\nprint(run(main()))", expect: "6", must: /await double/, why: "Without await you get the coroutine itself, not its result." },
        { type: "write", prompt: "Write an <b>async</b> function <code>total(nums)</code> that awaits the helper <code>square(n)</code> (already given, do not rewrite it) for each number and returns the sum of squares.", start: "async def square(n):\n    return n * n\n\n", solution: "async def square(n):\n    return n * n\n\nasync def total(nums):\n    s = 0\n    for n in nums:\n        s += await square(n)\n    return s", tests: [["def run(c):\n    try:\n        c.send(None)\n    except StopIteration as e:\n        return e.value", "run(total([1, 2, 3]))", "14"], ["def run(c):\n    try:\n        c.send(None)\n    except StopIteration as e:\n        return e.value", "run(total([]))", "0"]], must: /await square/, why: "Each await pauses until square finishes, then continues." },
      ] },
  ] });
})(typeof window !== "undefined" ? window : globalThis);
