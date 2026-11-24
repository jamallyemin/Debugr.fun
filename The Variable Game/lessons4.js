// Chapter 5: lists, text, tuples, dictionaries, sets. See lessons.js for the exercise types.
(function (root) {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("./lessons.js") : root.Lessons;

  L.add({ id: 5, name: "Collections", sub: "lists, text, tuples, dicts, sets", lessons: [
    { id: "5.1", title: "Lists", bug: "A list keeps many values in order. Each has a position, and the first position is 0, not 1.",
      read: [
        "A <b>list</b> keeps many values in one variable. Write it with square brackets: <code>fruits = [\"apple\", \"banana\", \"cherry\"]</code>.",
        "Every item has a position called an <b>index</b>, and counting starts at <b>0</b>. <code>fruits[0]</code> is apple. A negative index counts from the end: <code>fruits[-1]</code> is the last item. <code>len(fruits)</code> tells you how many items there are.",
        "You can change an item with <code>fruits[1] = \"mango\"</code>. Lists can hold anything, even other lists: <code>grid = [[1, 2], [3, 4]]</code> and <code>grid[1][0]</code> is 3.",
      ],
      try: { code: 'fruits = ["apple", "banana", "cherry"]\nprint(fruits[0])\nprint(fruits[-1])\nprint(len(fruits))\nfruits[1] = "mango"\nprint(fruits)', note: "Print fruits[3]. Read the error: that position does not exist." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'colors = ["red", "green", "blue"]\nprint(colors[1])', why: "Index 0 is red, so index 1 is green." },
        { type: "predict", prompt: "What will this show?", code: "nums = [10, 20, 30, 40]\nprint(nums[-1])", why: "-1 is the last item." },
        { type: "predict", prompt: "What will this show?", code: "grid = [[1, 2], [3, 4]]\nprint(grid[1][0])", why: "grid[1] is the second row, [3, 4], and its first item is 3." },
        { type: "fix", prompt: "This crashes with an IndexError. Fix it so it shows the last number, <b>3</b>.", code: "nums = [1, 2, 3]\nprint(nums[3])", solution: "nums = [1, 2, 3]\nprint(nums[2])", expect: "3", why: "A list of 3 items has positions 0, 1 and 2. (nums[-1] works too.)" },
        { type: "write", prompt: "Make <code>scores = [10, 20, 30]</code> and print the last item using a negative index. Show <b>30</b>.", start: "", solution: "scores = [10, 20, 30]\nprint(scores[-1])", expect: "30", must: /\[\s*-1\s*\]/, why: "print(scores[-1])." },
      ] },
    { id: "5.2", title: "Changing a list", bug: "Lists can grow and shrink. append adds to the end, pop takes one out.",
      read: [
        "<code>list.append(x)</code> adds to the end. <code>list.insert(i, x)</code> puts x at position i. <code>list.extend(other)</code> adds all items of another list.",
        "<code>list.remove(x)</code> removes the first x. <code>list.pop()</code> removes the last item <b>and gives it back</b>; <code>list.pop(i)</code> removes position i.",
        "<code>x in list</code> checks if something is in the list. Joining two lists with <code>+</code> makes a new list. These methods change the list itself, so there is no need to store the result.",
      ],
      try: { code: 'pets = ["cat", "dog"]\npets.append("fish")\npets.insert(0, "owl")\nprint(pets)\nlast = pets.pop()\nprint(last, pets)\npets.remove("cat")\nprint(pets, "dog" in pets)', note: "Predict the list after every line." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "a = [1, 2]\na.append(3)\na.append(4)\nprint(a)", why: "append adds to the end each time." },
        { type: "predict", prompt: "What will this show?", code: "a = [1, 2, 3]\nx = a.pop()\nprint(x, a)", why: "pop removes the last item (3), gives it back, and the list is left with [1, 2]." },
        { type: "fill", prompt: "Fill the blank so the list becomes <b>['a', 'b', 'c']</b>.", code: "letters = ['a', 'b']\nletters.___('c')\nprint(letters)", answer: "append", expect: "['a', 'b', 'c']", why: "append adds one item at the end." },
        { type: "write", prompt: "Start with <code>items = ['a', 'b', 'c', 'd']</code>, remove <b>'b'</b> and print the list. Show <b>['a', 'c', 'd']</b>.", start: "items = ['a', 'b', 'c', 'd']\n", solution: "items = ['a', 'b', 'c', 'd']\nitems.remove('b')\nprint(items)", expect: "['a', 'c', 'd']", must: /remove/, why: "items.remove('b') then print(items)." },
      ] },
    { id: "5.3", title: "Looping and slicing", bug: "for x in list gives you each item. list[a:b] cuts out a piece, from a up to (not including) b.",
      read: [
        "You can loop directly over a list: <code>for fruit in fruits:</code> gives each item in turn, no index needed.",
        "A <b>slice</b> cuts out a piece: <code>nums[1:3]</code> gives positions 1 and 2. Leave a side empty to go to the start or the end: <code>nums[:2]</code>, <code>nums[2:]</code>. A third number is the step, and <code>nums[::-1]</code> is the list reversed.",
        "Slices give you a new list, and the original is not changed. The same works for text, as you will see soon.",
      ],
      try: { code: 'nums = [10, 20, 30, 40, 50]\nfor n in nums:\n    print(n + 1)\nprint(nums[1:3])\nprint(nums[:2])\nprint(nums[::-1])', note: "Try nums[-2:] and nums[::2]." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "nums = [10, 20, 30, 40, 50]\nprint(nums[1:4])", why: "From position 1 up to, but not including, position 4: 20, 30, 40." },
        { type: "predict", prompt: "What will this show?", code: "print([1, 2, 3][::-1])", why: "A step of -1 reads the list backwards." },
        { type: "write", prompt: "Loop over <code>names = ['ada', 'bob']</code> and print each name in capital letters (one per line).", start: "names = ['ada', 'bob']\n", solution: "names = ['ada', 'bob']\nfor name in names:\n    print(name.upper())", expect: "ADA\nBOB", must: /\bfor\b/, why: "for name in names: print(name.upper())." },
        { type: "write", prompt: "With <code>nums = [10, 20, 30, 40, 50]</code>, print the <b>first three</b> items using a slice. Show <b>[10, 20, 30]</b>.", start: "nums = [10, 20, 30, 40, 50]\n", solution: "nums = [10, 20, 30, 40, 50]\nprint(nums[:3])", expect: "[10, 20, 30]", must: /\[[^\]]*:[^\]]*\]/, why: "nums[:3] means from the start up to position 3." },
      ] },
    { id: "5.4", title: "List tools", bug: "Python already knows how to sum, sort and find the biggest. Use the built-in tools before writing your own loop.",
      read: [
        "Built-in tools: <code>len(x)</code>, <code>sum(x)</code>, <code>min(x)</code>, <code>max(x)</code>. <code>sorted(x)</code> gives a new sorted list (add <code>reverse=True</code> for biggest first), while <code>x.sort()</code> sorts the list itself.",
        "<code>enumerate(x)</code> gives you the position and the item together: <code>for i, item in enumerate(x):</code>. <code>zip(a, b)</code> walks two lists side by side.",
        "<code>x.count(v)</code> counts how often v appears, and <code>x.index(v)</code> tells you the position of the first v.",
      ],
      try: { code: 'nums = [5, 1, 9, 3]\nprint(sum(nums), min(nums), max(nums))\nprint(sorted(nums))\nfor i, n in enumerate(nums):\n    print(i, n)\nnames = ["ada", "bob"]\nages = [36, 25]\nfor name, age in zip(names, ages):\n    print(name, age)', note: "Print sorted(nums, reverse=True)." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(sorted([3, 1, 2]))", why: "sorted puts them in order from small to big." },
        { type: "predict", prompt: "What will this show?", code: 'for i, c in enumerate(["x", "y"]):\n    print(i, c)', why: "enumerate gives the position first and then the item." },
        { type: "fill", prompt: "Fill the blank so it shows the biggest number, <b>9</b>.", code: "print(___([5, 1, 9, 3]))", answer: "max", expect: "9", why: "max returns the biggest item." },
        { type: "write", prompt: "With <code>scores = [80, 90, 100]</code>, print the <b>average</b> using <code>sum</code> and <code>len</code>. Show <b>90.0</b>.", start: "scores = [80, 90, 100]\n", solution: "scores = [80, 90, 100]\nprint(sum(scores) / len(scores))", expect: "90.0", must: /sum/, why: "The average is the total divided by how many there are. A / division gives a decimal." },
        { type: "write", prompt: "Print <code>[5, 1, 9, 3]</code> sorted from <b>biggest to smallest</b>. Show <b>[9, 5, 3, 1]</b>.", start: "", solution: "print(sorted([5, 1, 9, 3], reverse=True))", expect: "[9, 5, 3, 1]", must: /reverse/, why: "sorted(..., reverse=True)." },
      ] },
    { id: "5.5", title: "Text is a sequence", bug: "Text works like a list of letters: indexes and slices work, and so do loops. But you can't change a letter in place.",
      read: [
        "Text is a sequence of characters, so indexing and slicing work just like on lists: <code>\"python\"[0]</code> is p, <code>\"python\"[1:4]</code> is yth, and <code>\"python\"[::-1]</code> is nohtyp. You can also loop over the letters.",
        "Text can't be changed in place (<code>s[0] = \"J\"</code> is an error). Methods give you a <b>new</b> text: <code>split()</code> breaks text into a list of words, <code>\"-\".join(list)</code> glues a list into text, <code>strip()</code> removes spaces at the ends, <code>find()</code> gives a position (or -1), <code>startswith()</code>, <code>endswith()</code>, <code>count()</code>, <code>lower()</code>.",
        "f-strings can format numbers: <code>f\"{3.14159:.2f}\"</code> is 3.14 (two decimals), <code>f\"{5:03}\"</code> is 005, and <code>f\"{1234567:,}\"</code> is 1,234,567.",
      ],
      try: { code: 's = "python"\nprint(s[0], s[1:4], s[::-1])\nwords = "the quick brown fox".split()\nprint(words)\nprint("-".join(words))\nprint("  hi  ".strip() + "!")\nprint(f"{3.14159:.2f}")', note: "Try s.find(\"th\") and s.count(\"o\")." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'print("a,b,c".split(","))', why: "split cuts the text at every comma and gives a list." },
        { type: "predict", prompt: "What will this show?", code: 'print(" ".join(["good", "morning"]))', why: "join glues the items together with a space between them." },
        { type: "fix", prompt: "Text can't be changed in place. Make this show <b>Jython</b>.", code: 's = "python"\ns[0] = "J"\nprint(s)', solution: 's = "python"\ns = "J" + s[1:]\nprint(s)', expect: "Jython", why: "Build a new text instead: \"J\" plus everything from position 1." },
        { type: "write", prompt: "Print the word <b>bug</b> reversed (<b>gub</b>) using a slice.", start: "", solution: 'print("bug"[::-1])', expect: "gub", must: /::\s*-1/, why: "A step of -1 reads backwards." },
        { type: "write", prompt: "With <code>pi = 3.14159</code>, print it with two decimals using an f-string. Show <b>3.14</b>.", start: "pi = 3.14159\n", solution: 'pi = 3.14159\nprint(f"{pi:.2f}")', expect: "3.14", must: /:\.2f/, why: "Inside the braces, :.2f means 2 decimals." },
      ] },
    { id: "5.6", title: "Tuples and unpacking", bug: "A tuple is a list you can't change. Handy for things that belong together, like a point (x, y).",
      read: [
        "A <b>tuple</b> is like a list but it <b>can't be changed</b> after it is made. Write it with round brackets: <code>point = (3, 4)</code>. Indexing and slicing work as on lists.",
        "<b>Unpacking</b> pulls the values out into separate variables: <code>x, y = point</code>. You can also use it to swap two variables in one line: <code>a, b = b, a</code>.",
        "A tuple with one item needs a trailing comma: <code>(5,)</code>. Functions that give back several values really give back a tuple.",
      ],
      try: { code: 'point = (3, 4)\nprint(point[0], len(point))\nx, y = point\nprint(x, y)\na, b = 1, 2\na, b = b, a\nprint(a, b)', note: "Try point[0] = 9 and read the error." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "a, b, c = (1, 2, 3)\nprint(b)", why: "The values are handed out in order, so b gets 2." },
        { type: "choice", prompt: "What is the main difference between a tuple and a list?", options: ["A tuple can't be changed after it is made", "A tuple can only hold numbers", "A tuple is always sorted"], answer: 0, why: "Tuples are fixed. Lists can grow, shrink and change." },
        { type: "fix", prompt: "A tuple can't be changed. Make this show <b>[9, 4]</b> by using the right kind of collection.", code: "point = (3, 4)\npoint[0] = 9\nprint(point)", solution: "point = [3, 4]\npoint[0] = 9\nprint(point)", expect: "[9, 4]", why: "Use a list (square brackets) when you need to change things." },
        { type: "write", prompt: "With <code>a = 1</code> and <code>b = 2</code>, swap them in <b>one line</b> and print <b>2 1</b>.", start: "a = 1\nb = 2\n", solution: "a = 1\nb = 2\na, b = b, a\nprint(a, b)", expect: "2 1", must: /a\s*,\s*b\s*=\s*b\s*,\s*a/, why: "a, b = b, a swaps without a helper variable." },
      ] },
    { id: "5.7", title: "Dictionaries", bug: "A dictionary looks things up by name (the key), not by position. Like a real dictionary: word to meaning.",
      read: [
        "A <b>dictionary</b> stores pairs of <b>key: value</b> inside curly brackets: <code>ages = {\"Ada\": 36, \"Bob\": 25}</code>. You look things up by key: <code>ages[\"Ada\"]</code> is 36. Keys are usually text or numbers, and every key appears only once.",
        "Add or change with <code>ages[\"Cy\"] = 30</code>. Ask <code>\"Ada\" in ages</code> (it checks the keys). A missing key is a <code>KeyError</code>, so use <code>ages.get(\"Zed\", 0)</code> to get a fallback instead. Remove with <code>del ages[\"Bob\"]</code> or <code>ages.pop(\"Bob\")</code>.",
        "Loop with <code>for key in d</code>, or use <code>d.keys()</code>, <code>d.values()</code> and <code>d.items()</code>: <code>for name, age in ages.items():</code>.",
      ],
      try: { code: 'ages = {"Ada": 36, "Bob": 25}\nprint(ages["Ada"])\nages["Cy"] = 30\nprint("Bob" in ages, ages.get("Zed", 0))\nfor name, age in ages.items():\n    print(name, "is", age)', note: "Print ages[\"Zed\"] and read the KeyError." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'd = {"a": 1, "b": 2}\nd["c"] = 3\nprint(len(d))', why: "Adding a new key makes the dictionary grow to 3 pairs." },
        { type: "predict", prompt: "What will this show?", code: 'd = {"a": 1}\nprint(d.get("z", 0))', why: "z is not there, so get gives the fallback 0 instead of an error." },
        { type: "fix", prompt: "This crashes with a KeyError. Use a safe lookup with a fallback so it shows <b>0</b>.", code: 'stock = {"apple": 5}\nprint(stock["pear"])', solution: 'stock = {"apple": 5}\nprint(stock.get("pear", 0))', expect: "0", why: "d.get(key, fallback) never crashes on a missing key." },
        { type: "write", prompt: "Make <code>ages = {'Ada': 36, 'Bob': 25}</code>. Loop over <code>ages.items()</code> and print lines like <b>Ada is 36</b>.", start: "ages = {'Ada': 36, 'Bob': 25}\n", solution: "ages = {'Ada': 36, 'Bob': 25}\nfor name, age in ages.items():\n    print(f\"{name} is {age}\")", expect: "Ada is 36\nBob is 25", must: /items\(\)/, why: "for name, age in ages.items(): print(f\"{name} is {age}\")." },
      ] },
    { id: "5.8", title: "Sets", bug: "A set keeps each value only once and doesn't care about order. Great for removing duplicates.",
      read: [
        "A <b>set</b> is a collection of <b>unique</b> values with no order. Write it with curly brackets <code>{1, 2, 3}</code> (an empty set is <code>set()</code>, because <code>{}</code> is an empty dictionary). <code>set(my_list)</code> removes all duplicates.",
        "<code>s.add(x)</code> adds, <code>s.remove(x)</code> removes. Checking <code>x in s</code> is very fast. Sets have no positions, so <code>s[0]</code> does not work, and when you want a predictable order use <code>sorted(s)</code>.",
        "Set maths: <code>a | b</code> everything from both, <code>a &amp; b</code> only what is in both, <code>a - b</code> what is in a but not in b.",
      ],
      try: { code: 'nums = [3, 1, 3, 2, 1]\nunique = set(nums)\nprint(len(unique), sorted(unique))\na = {1, 2, 3}\nb = {2, 3, 4}\nprint(sorted(a | b), sorted(a & b), sorted(a - b))', note: "Add 5 to a with a.add(5)." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(len(set([1, 1, 2, 3, 3])))", why: "The set keeps 1, 2 and 3 once each: 3 values." },
        { type: "predict", prompt: "What will this show?", code: "a = {1, 2, 3}\nb = {2, 3, 4}\nprint(sorted(a & b))", why: "& keeps what is in both: 2 and 3." },
        { type: "fill", prompt: "Fill the blank so it shows <b>[1, 2, 3, 4]</b>.", code: "a = {1, 2, 3}\nb = {2, 3, 4}\nprint(sorted(a ___ b))", answer: "|", expect: "[1, 2, 3, 4]", why: "| joins both sets." },
        { type: "write", prompt: "Remove the duplicates from <code>[4, 2, 4, 1, 2]</code> and print them sorted. Show <b>[1, 2, 4]</b>.", start: "", solution: "print(sorted(set([4, 2, 4, 1, 2])))", expect: "[1, 2, 4]", must: /set/, why: "set() removes duplicates and sorted() makes a list in order." },
      ] },
    { id: "5.9", title: "Mini project: word counter", bug: "A dictionary is perfect for counting. The word is the key, the number of times is the value.",
      read: [
        "Let's use lists, text and dictionaries together. A very common pattern: count things with a dictionary. For every item, add 1 to its count, using <code>d.get(item, 0) + 1</code>.",
      ],
      try: { code: 'text = "the cat and the hat"\ncounts = {}\nfor word in text.split():\n    counts[word] = counts.get(word, 0) + 1\nprint(counts)', note: "Read it slowly: for each word, take the old count (or 0) and add 1." },
      ex: [
        { type: "write", prompt: "Count the words in <code>text = \"the cat and the hat and the bat\"</code>, then print how often <b>the</b> appears (<b>3</b>).", start: 'text = "the cat and the hat and the bat"\n', solution: 'text = "the cat and the hat and the bat"\ncounts = {}\nfor word in text.split():\n    counts[word] = counts.get(word, 0) + 1\nprint(counts["the"])', expect: "3", must: /\.get\(|\+=\s*1/, why: "Loop over text.split() and add 1 to the count of each word." },
        { type: "write", prompt: "With the same text, print the <b>unique words</b> sorted, as a list. Show <b>['and', 'bat', 'cat', 'hat', 'the']</b>.", start: 'text = "the cat and the hat and the bat"\n', solution: 'text = "the cat and the hat and the bat"\nprint(sorted(set(text.split())))', expect: "['and', 'bat', 'cat', 'hat', 'the']", must: /set/, why: "split() makes the words, set() keeps each once, sorted() orders them." },
        { type: "write", prompt: "Print the <b>longest word</b> of <code>words = ['sun', 'planet', 'moon']</code> (<b>planet</b>). Hint: <code>max</code> can take <code>key=len</code>.", start: "words = ['sun', 'planet', 'moon']\n", solution: "words = ['sun', 'planet', 'moon']\nprint(max(words, key=len))", expect: "planet", must: /len/, why: "max(words, key=len) compares the words by their length." },
      ] },
  ] });
})(typeof window !== "undefined" ? window : globalThis);
