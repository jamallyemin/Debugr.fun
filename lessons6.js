// Chapter 8 (modules and files) and chapter 9 (classes and objects). See lessons.js for the exercise types.
(function (root) {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("./lessons.js") : root.Lessons;

  L.add({ id: 8, name: "Modules and files", sub: "import, random, collections, json, files", lessons: [
    { id: "8.1", title: "import", bug: "A module is someone else's toolbox. import brings it in, and then you use module.tool().",
      read: [
        "Python comes with a big <b>standard library</b>: ready-made code in <b>modules</b>. You bring a module in with <code>import</code> and then use its tools with a dot: <code>import math</code>, <code>math.sqrt(16)</code>.",
        "You can also pull out just one tool, <code>from math import sqrt</code> (then call <code>sqrt(16)</code> directly), or give the module a shorter name, <code>import math as m</code>.",
        "Handy in <code>math</code>: <code>sqrt</code>, <code>pi</code>, <code>floor</code> (round down), <code>ceil</code> (round up), <code>abs</code> is built in. Using a module without importing it is a <code>NameError</code>.",
      ],
      try: { code: 'import math\nprint(math.sqrt(16))\nprint(math.pi)\nprint(math.floor(3.7), math.ceil(3.2))\nfrom math import sqrt\nprint(sqrt(2))', note: "Try math.factorial(5) and math.gcd(12, 18)." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "import math\nprint(math.sqrt(16))", why: "The square root of 16 is 4, and sqrt always gives a decimal: 4.0." },
        { type: "predict", prompt: "What will this show?", code: "import math\nprint(math.floor(3.7), math.ceil(3.2))", why: "floor rounds down (3), ceil rounds up (4)." },
        { type: "fix", prompt: "Python says <code>math</code> is not defined. Fix it so it shows <b>3.0</b>.", code: "print(math.sqrt(9))", solution: "import math\nprint(math.sqrt(9))", expect: "3.0", why: "You have to import a module before you use it." },
        { type: "write", prompt: "Use <code>math.sqrt</code> to print the length of the long side of a right triangle with sides 3 and 4 (<b>5.0</b>).", start: "", solution: "import math\nprint(math.sqrt(3 ** 2 + 4 ** 2))", expect: "5.0", must: /sqrt/, why: "The Pythagorean theorem: the square root of 3² + 4²." },
      ] },
    { id: "8.2", title: "random", bug: "random is how games surprise you. Run the same program twice and you get different answers. That's the point!",
      read: [
        "<code>import random</code> gives you chance. <code>random.randint(1, 6)</code> is a whole number from 1 to 6 (both included). <code>random.choice(items)</code> picks one item. <code>random.shuffle(items)</code> mixes a list in place. <code>random.random()</code> is a decimal between 0 and 1. <code>random.sample(items, k)</code> picks k different items.",
        "Results change on every run. For testing you can fix them with <code>random.seed(42)</code>: the same seed always gives the same 'random' numbers.",
      ],
      try: { code: 'import random\nprint(random.randint(1, 6))\nprint(random.choice(["rock", "paper", "scissors"]))\ndeck = [1, 2, 3, 4, 5]\nrandom.shuffle(deck)\nprint(deck)', note: "Run it a few times. Then add random.seed(1) at the top and run again." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "import random\nprint(random.choice([7]))", why: "There is only one item to choose from, so it is always 7." },
        { type: "predict", prompt: "What will this show?", code: "import random\nprint(len(random.sample(range(10), 3)))", why: "sample picks 3 different numbers, so the list has 3 items." },
        { type: "choice", prompt: "What does <code>random.seed(42)</code> do?", options: ["Makes the 'random' numbers the same every run", "Makes the numbers bigger", "Stops random from working"], answer: 0, why: "A seed fixes the starting point, so the sequence is repeatable. That is useful for testing and for sharing a puzzle." },
        { type: "write", prompt: "Write <code>roll()</code> that returns a random whole number from 1 to 6, like a die.", start: "import random\n\n", solution: "import random\n\ndef roll():\n    return random.randint(1, 6)", tests: [["1 <= roll() <= 6", "True"], ["all(1 <= roll() <= 6 for _ in range(60))", "True"], ["{roll() for _ in range(300)} == {1, 2, 3, 4, 5, 6}", "True"]], must: /randint|choice|randrange/, why: "random.randint(1, 6) includes both ends." },
      ] },
    { id: "8.3", title: "More of the library", bug: "Before you write something clever, check if the standard library already has it. Counter, datetime and json save hours.",
      read: [
        "<code>collections.Counter</code> counts things for you: <code>Counter(\"hello\")</code> gives <code>{'l': 2, ...}</code>, and <code>.most_common(1)</code> gives the top item. <code>collections.defaultdict(list)</code> is a dictionary that makes missing keys automatically.",
        "<code>datetime.date(2024, 3, 1)</code> is a calendar date. Subtracting two dates gives a gap, and <code>.days</code> turns it into a number.",
        "<code>json</code> turns data into text and back, for saving or sending it: <code>json.dumps({\"a\": 1})</code> gives the text <code>{\"a\": 1}</code> and <code>json.loads(text)</code> gives the data back.",
      ],
      try: { code: 'from collections import Counter\nfrom datetime import date\nimport json\n\nprint(Counter("hello").most_common(1))\ngap = date(2024, 3, 1) - date(2024, 2, 1)\nprint(gap.days)\ntext = json.dumps({"name": "Ada", "scores": [1, 2]})\nprint(text)\nprint(json.loads(text)["scores"])', note: "How many days until the new year? Make your own dates." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'from collections import Counter\nprint(Counter("banana")["a"])', why: "There are 3 letters a in banana." },
        { type: "predict", prompt: "What will this show?", code: 'import json\nprint(json.dumps({"a": 1}))', why: "dumps turns the data into text, and Python writes it with double quotes." },
        { type: "write", prompt: "Print the <b>most common letter</b> of <code>\"hello\"</code> (<b>l</b>) using <code>Counter</code>.", start: "from collections import Counter\n", solution: 'from collections import Counter\nprint(Counter("hello").most_common(1)[0][0])', expect: "l", must: /most_common/, why: "most_common(1) is a list with one pair like [('l', 2)], so take [0][0]." },
        { type: "write", prompt: "Print how many days there are between <b>2024-01-01</b> and <b>2025-01-01</b> using <code>date</code> (<b>366</b>, 2024 is a leap year).", start: "from datetime import date\n", solution: "from datetime import date\nprint((date(2025, 1, 1) - date(2024, 1, 1)).days)", expect: "366", must: /\.days/, why: "Subtract the dates and take .days." },
      ] },
    { id: "8.4", title: "Files", bug: "open() with 'w' writes (and erases what was there!), 'r' reads, 'a' adds to the end. with closes the file for you.",
      read: [
        "Programs can save and load text files. <code>with open(\"notes.txt\", \"w\") as f:</code> opens a file for <b>writing</b> (<code>\"w\"</code> erases the old content!), then <code>f.write(\"hello\\n\")</code>. Use <code>\"a\"</code> to add to the end and <code>\"r\"</code> (the default) to read.",
        "To read: <code>f.read()</code> gives all the text, <code>f.readlines()</code> gives a list of lines, and <code>for line in f:</code> goes through them one by one. Always use <code>with</code>: it closes the file for you, even if there is an error.",
        "Note: in this browser the files live in a temporary space that disappears when you close or reload the page. On your own computer they would stay.",
      ],
      try: { code: 'with open("notes.txt", "w") as f:\n    f.write("first\\n")\n    f.write("second\\n")\n\nwith open("notes.txt") as f:\n    for line in f:\n        print(line.strip())', note: "Change \"w\" to \"a\" and run it a few times. What happens to the file?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'with open("hello.txt", "w") as f:\n    f.write("hi there")\nwith open("hello.txt") as f:\n    print(f.read())', why: "We write the text into the file and then read the same text back." },
        { type: "choice", prompt: "What does opening a file with mode <code>\"w\"</code> do to its old content?", options: ["Keeps it and adds to the end", "Erases it", "Nothing, you can only read"], answer: 1, why: "\"w\" starts the file from empty. Use \"a\" to add without losing anything." },
        { type: "fix", prompt: "Writing fails because the file is opened for reading. Fix it so it shows <b>2</b>.", code: 'with open("log.txt", "r") as f:\n    f.write("a\\nb\\n")\nwith open("log.txt") as f:\n    print(len(f.readlines()))', solution: 'with open("log.txt", "w") as f:\n    f.write("a\\nb\\n")\nwith open("log.txt") as f:\n    print(len(f.readlines()))', expect: "2", why: "To write you need the mode \"w\"." },
        { type: "write", prompt: "Write the numbers 1, 2, 3 (one per line) to <code>nums.txt</code>, then read the file back and print their sum (<b>6</b>).", start: "", solution: 'with open("nums.txt", "w") as f:\n    for i in range(1, 4):\n        f.write(f"{i}\\n")\nwith open("nums.txt") as f:\n    print(sum(int(line) for line in f))', expect: "6", must: /open\(/, why: "Write with a loop, then read the lines back and add them up (line is text, so convert it with int)." },
      ] },
    { id: "8.5", title: "Mini project: toolbox", bug: "Pick the right module for the job, import it, and let it do the heavy lifting.",
      read: [
        "Three small jobs where the library does the hard part. Read the task, think which module fits, and write only the glue.",
      ],
      try: { code: 'from collections import Counter\ntext = "to be or not to be"\nprint(Counter(text.split()).most_common(2))', note: "A top-2 of the words in a text, in two lines." },
      ex: [
        { type: "write", prompt: "Write <code>top_word(text)</code> that returns the most common word in a text.", start: "", solution: "from collections import Counter\n\ndef top_word(text):\n    return Counter(text.split()).most_common(1)[0][0]", tests: [["top_word('to be or not to be')", "'to'"], ["top_word('a b b')", "'b'"]], why: "Counter + most_common(1) on the split words." },
        { type: "write", prompt: "<code>date</code> is imported. Write <code>age_in_days(born, today)</code> that returns how many days lie between two dates.", start: "from datetime import date\n\n", solution: "from datetime import date\n\ndef age_in_days(born, today):\n    return (today - born).days", tests: [["age_in_days(date(2000, 1, 1), date(2000, 1, 31))", "30"], ["age_in_days(date(2024, 2, 1), date(2024, 3, 1))", "29"]], why: "Subtract the dates and take .days." },
        { type: "write", prompt: "Write <code>save_and_load(data)</code> that saves <code>data</code> as JSON in a file <code>data.json</code>, reads it back and returns it.", start: "import json\n\n", solution: 'import json\n\ndef save_and_load(data):\n    with open("data.json", "w") as f:\n        json.dump(data, f)\n    with open("data.json") as f:\n        return json.load(f)', tests: [["save_and_load({'a': [1, 2]})", "{'a': [1, 2]}"], ["save_and_load([1, 'x'])", "[1, 'x']"]], must: /json\.dump/, why: "json.dump(data, f) writes, json.load(f) reads." },
      ] },
  ] });

  L.add({ id: 9, name: "Classes and objects", sub: "class, __init__, methods, inheritance", lessons: [
    { id: "9.1", title: "Everything is an object", bug: "An object is data bundled with the things it can do. A list is an object: it has items and methods like append.",
      read: [
        "You have been using <b>objects</b> all along. A list holds data (its items) and comes with actions (<b>methods</b>) like <code>append</code>. Text has <code>upper</code>. A dictionary has <code>get</code>. <code>type(x)</code> tells you what kind of object something is.",
        "A <b>class</b> is a blueprint that describes a new kind of object, and an <b>instance</b> is one object made from it. <code>class Player:</code> defines a blueprint. <code>p = Player()</code> makes one player. You can hang data on it: <code>p.name = \"Ada\"</code>. These named pieces of data are called <b>attributes</b>.",
      ],
      try: { code: 'print(type(5), type("hi"), type([1]))\n\nclass Player:\n    pass\n\np = Player()\np.name = "Ada"\np.score = 10\nprint(p.name, p.score)\nprint(type(p))', note: "Make a second player and give it different values." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(type(3.5))", why: "3.5 is a decimal number: the class float." },
        { type: "choice", prompt: "What is the relationship between a class and an object?", options: ["A class is a blueprint, an object is one thing built from it", "They are the same thing", "An object is a blueprint, a class is one thing built from it"], answer: 0, why: "Think of a cookie cutter (class) and the cookies (objects)." },
        { type: "predict", prompt: "What will this show?", code: "class Box:\n    pass\n\nb = Box()\nb.size = 3\nprint(b.size * 2)", why: "The attribute size was set to 3 on this object, and 3 * 2 is 6." },
        { type: "write", prompt: "Make a class <code>Point</code> (just <code>pass</code> inside), create a point <code>p</code>, give it <code>x = 3</code> and <code>y = 4</code>, and print <b>3 4</b>.", start: "", solution: "class Point:\n    pass\n\np = Point()\np.x = 3\np.y = 4\nprint(p.x, p.y)", expect: "3 4", must: /class\s+Point/, why: "class Point: pass, then p = Point() and set p.x and p.y." },
      ] },
    { id: "9.2", title: "__init__ and self", bug: "__init__ runs automatically when you make an object. self means 'this very object'.",
      read: [
        "Setting attributes by hand every time is boring. A special method called <code>__init__</code> runs <b>automatically</b> when an object is created and sets it up: <code>def __init__(self, name):</code>.",
        "<code>self</code> is the object being created. <code>self.name = name</code> stores the argument on that object. Every method gets <code>self</code> as its first parameter, but you don't pass it when calling: <code>Dog(\"Rex\")</code>.",
        "Each object has its own copy of the attributes, so two dogs can have different names.",
      ],
      try: { code: 'class Dog:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n\nd = Dog("Rex", 3)\ne = Dog("Luna", 5)\nprint(d.name, d.age)\nprint(e.name, e.age)', note: "Add a third attribute, like color." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "class P:\n    def __init__(self, x):\n        self.x = x\n\na = P(1)\nb = P(2)\nprint(a.x, b.x)", why: "Each object keeps its own x." },
        { type: "fix", prompt: "Every method needs <code>self</code> first. Fix it so it shows <b>Rex</b>.", code: 'class Dog:\n    def __init__(name):\n        self.name = name\n\nd = Dog("Rex")\nprint(d.name)', solution: 'class Dog:\n    def __init__(self, name):\n        self.name = name\n\nd = Dog("Rex")\nprint(d.name)', expect: "Rex", why: "Python passes the new object as the first argument, so __init__ needs a parameter called self for it." },
        { type: "write", prompt: "Write a class <code>Player</code> whose <code>__init__(self, name)</code> stores the name and starts <code>self.score</code> at 0.", start: "", solution: "class Player:\n    def __init__(self, name):\n        self.name = name\n        self.score = 0", tests: [["Player('Ada').name", "'Ada'"], ["Player('Ada').score", "0"], ["Player('Bob').name", "'Bob'"]], must: /__init__/, why: "self.name = name and self.score = 0 inside __init__." },
      ] },
    { id: "9.3", title: "Methods", bug: "A method is a function that belongs to the object. It can read and change self's data.",
      read: [
        "A <b>method</b> is a function defined inside a class. Because it gets <code>self</code>, it can read and <b>change</b> the object's own data: <code>self.score += points</code>.",
        "Call it with a dot on an object: <code>player.add_points(5)</code>. This is how objects keep their state together with the code that works on it: a bank account holds a balance <b>and</b> knows how to deposit.",
        "A method can <code>return</code> a value like any function, and it can call other methods with <code>self.other_method()</code>.",
      ],
      try: { code: 'class Account:\n    def __init__(self, balance):\n        self.balance = balance\n\n    def deposit(self, amount):\n        self.balance += amount\n\n    def is_rich(self):\n        return self.balance > 100\n\nacc = Account(50)\nacc.deposit(70)\nprint(acc.balance, acc.is_rich())', note: "Add a withdraw method." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "class Counter:\n    def __init__(self):\n        self.n = 0\n    def add(self):\n        self.n += 1\n\nc = Counter()\nc.add()\nc.add()\nprint(c.n)", why: "Each call to add changes this counter's n by 1. Two calls make 2." },
        { type: "write", prompt: "Write a class <code>Counter</code> with <code>value</code> starting at 0 and a method <code>add()</code> that increases it by 1.", start: "", solution: "class Counter:\n    def __init__(self):\n        self.value = 0\n\n    def add(self):\n        self.value += 1", tests: [["Counter().value", "0"], ["c = Counter(); c.add(); c.add()", "c.value", "2"]], why: "__init__ sets value to 0, and add does self.value += 1." },
        { type: "write", prompt: "Write a class <code>Account</code> with a <code>balance</code> (given when created) and methods <code>deposit(amount)</code> and <code>withdraw(amount)</code>. A withdraw that is bigger than the balance should raise <code>ValueError</code>.", start: "", solution: "class Account:\n    def __init__(self, balance):\n        self.balance = balance\n\n    def deposit(self, amount):\n        self.balance += amount\n\n    def withdraw(self, amount):\n        if amount > self.balance:\n            raise ValueError('not enough money')\n        self.balance -= amount", tests: [["a = Account(50); a.deposit(20)", "a.balance", "70"], ["a = Account(50); a.withdraw(20)", "a.balance", "30"], ["a = Account(10); a.withdraw(20)", "a.balance", "error: ValueError: not enough money"]], must: /raise/, why: "deposit adds, withdraw checks first and raises ValueError if the amount is too big." },
      ] },
    { id: "9.4", title: "Special methods", bug: "Names with double underscores let your objects work with Python's own tools: print, len, ==, +.",
      read: [
        "Methods with double underscores are called <b>special (dunder) methods</b>. Python calls them for you. <code>__str__</code> decides what <code>print(obj)</code> shows. <code>__repr__</code> is the developer view. <code>__len__</code> makes <code>len(obj)</code> work. <code>__eq__</code> defines <code>==</code>. <code>__add__</code> defines <code>+</code>.",
        "Without <code>__str__</code>, printing an object shows an unhelpful address like <code>&lt;Point object at 0x7f...&gt;</code>. One short method fixes that.",
      ],
      try: { code: 'class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n    def __str__(self):\n        return f"({self.x}, {self.y})"\n    def __eq__(self, other):\n        return self.x == other.x and self.y == other.y\n    def __add__(self, other):\n        return Point(self.x + other.x, self.y + other.y)\n\na = Point(1, 2)\nb = Point(3, 4)\nprint(a)\nprint(a + b)\nprint(a == Point(1, 2))', note: "Add a __len__ that returns 2, then try len(a)." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'class Cat:\n    def __str__(self):\n        return "meow"\n\nprint(Cat())', why: "print calls __str__ and shows the text it returns." },
        { type: "choice", prompt: "Which special method makes <code>len(thing)</code> work on your object?", options: ["<code>__size__</code>", "<code>__len__</code>", "<code>__count__</code>"], answer: 1, why: "len(x) calls x.__len__()." },
        { type: "write", prompt: "Give <code>Point</code> a <code>__str__</code> so that <code>str(Point(1, 2))</code> is <b>(1, 2)</b>.", start: "class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\n", solution: "class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\n    def __str__(self):\n        return f\"({self.x}, {self.y})\"", tests: [["str(Point(1, 2))", "'(1, 2)'"], ["str(Point(-3, 0))", "'(-3, 0)'"]], must: /__str__/, why: "__str__ returns the text: f\"({self.x}, {self.y})\"." },
        { type: "write", prompt: "Give <code>Point</code> an <code>__add__</code> so that <code>Point(1, 2) + Point(3, 4)</code> is a point with x = 4 and y = 6.", start: "class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\n", solution: "class Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\n    def __add__(self, other):\n        return Point(self.x + other.x, self.y + other.y)", tests: [["p = Point(1, 2) + Point(3, 4)", "(p.x, p.y)", "(4, 6)"]], must: /__add__/, why: "Return a new Point with the sums." },
      ] },
    { id: "9.5", title: "Inheritance", bug: "A child class gets everything from its parent for free, and can add or replace parts. super() reaches the parent.",
      read: [
        "<b>Inheritance</b> lets a class start from another one: <code>class Cat(Animal):</code> means a Cat is an Animal and gets all its attributes and methods. Then the child can <b>add</b> new things or <b>override</b> (replace) old ones.",
        "Inside the child, <code>super()</code> gives access to the parent. A common use is <code>super().__init__(name)</code>, so the parent sets up its part and the child adds its own.",
        "<code>isinstance(x, Animal)</code> checks if x is an Animal (or a child of it). The same method call can behave differently for each child. That is called <b>polymorphism</b>.",
      ],
      try: { code: 'class Animal:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        return f"{self.name} makes a sound"\n\nclass Dog(Animal):\n    def speak(self):\n        return f"{self.name} says woof"\n\nclass Cat(Animal):\n    def __init__(self, name, indoor):\n        super().__init__(name)\n        self.indoor = indoor\n\nfor pet in [Animal("Thing"), Dog("Rex"), Cat("Tom", True)]:\n    print(pet.speak())', note: "Which speak() ran for each pet?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "class A:\n    def hi(self):\n        return 'A'\nclass B(A):\n    def hi(self):\n        return 'B'\n\nprint(B().hi())", why: "B overrides hi, so its own version runs." },
        { type: "predict", prompt: "What will this show?", code: "class A:\n    pass\nclass B(A):\n    pass\n\nprint(isinstance(B(), A))", why: "A B is also an A, because B inherits from A." },
        { type: "write", prompt: "<code>Animal</code> is given. Write <code>Dog(Animal)</code> that overrides <code>speak()</code> to return <b>woof</b>.", start: "class Animal:\n    def speak(self):\n        return '...'\n\n", solution: "class Animal:\n    def speak(self):\n        return '...'\n\nclass Dog(Animal):\n    def speak(self):\n        return 'woof'", tests: [["Dog().speak()", "'woof'"], ["isinstance(Dog(), Animal)", "True"], ["Animal().speak()", "'...'"]], must: /class\s+Dog\s*\(\s*Animal\s*\)/, why: "class Dog(Animal): and its own speak method." },
        { type: "write", prompt: "<code>Animal</code> is given. Write <code>Cat(Animal)</code> whose <code>__init__(self, name, lives)</code> calls <code>super().__init__(name)</code> and stores <code>lives</code>.", start: "class Animal:\n    def __init__(self, name):\n        self.name = name\n\n", solution: "class Animal:\n    def __init__(self, name):\n        self.name = name\n\nclass Cat(Animal):\n    def __init__(self, name, lives):\n        super().__init__(name)\n        self.lives = lives", tests: [["c = Cat('Tom', 9)", "(c.name, c.lives)", "('Tom', 9)"]], must: /super\(\)/, why: "super().__init__(name) lets the parent store the name." },
      ] },
    { id: "9.6", title: "Mini project: build a class", bug: "Ask: what does it remember (attributes) and what can it do (methods)?",
      read: [
        "One more class, a bit more thinking. A <b>stack</b> is like a pile of plates: you can only add to the top (<code>push</code>) and take from the top (<code>pop</code>). Think about what it must remember, and what it can do.",
      ],
      try: { code: 'class Stack:\n    def __init__(self):\n        self.items = []\n    def push(self, x):\n        self.items.append(x)\n    def pop(self):\n        return self.items.pop()\n\ns = Stack()\ns.push(1)\ns.push(2)\nprint(s.pop(), s.pop())', note: "The last thing in is the first thing out." },
      ex: [
        { type: "write", prompt: "Write a class <code>Stack</code> with <code>push(x)</code>, <code>pop()</code> (returns the top), <code>peek()</code> (shows the top without removing it) and <code>__len__</code> (how many items).", start: "", solution: "class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, x):\n        self.items.append(x)\n\n    def pop(self):\n        return self.items.pop()\n\n    def peek(self):\n        return self.items[-1]\n\n    def __len__(self):\n        return len(self.items)", tests: [["s = Stack(); s.push(1); s.push(2)", "s.pop()", "2"], ["s = Stack(); s.push(1); s.push(2)", "s.peek()", "2"], ["s = Stack(); s.push(1); s.push(2); s.pop()", "len(s)", "1"], ["len(Stack())", "0"]], must: /__len__/, why: "Keep the items in a list. The top is the last item." },
        { type: "write", prompt: "Write a class <code>Player</code> with a <code>name</code>, <code>hp</code> (starts at 100) and a method <code>hit(damage)</code>. <code>hp</code> must never go below 0, and the method <code>is_alive()</code> says if hp is above 0.", start: "", solution: "class Player:\n    def __init__(self, name):\n        self.name = name\n        self.hp = 100\n\n    def hit(self, damage):\n        self.hp = max(0, self.hp - damage)\n\n    def is_alive(self):\n        return self.hp > 0", tests: [["p = Player('Ada'); p.hit(30)", "p.hp", "70"], ["p = Player('Ada'); p.hit(500)", "p.hp", "0"], ["p = Player('Ada'); p.hit(500)", "p.is_alive()", "False"], ["Player('Ada').is_alive()", "True"]], why: "max(0, ...) keeps hp from going negative." },
        { type: "write", prompt: "Write a class <code>Temperature</code> that is created with degrees Celsius and has a method <code>to_fahrenheit()</code> (Celsius × 9 / 5 + 32).", start: "", solution: "class Temperature:\n    def __init__(self, celsius):\n        self.celsius = celsius\n\n    def to_fahrenheit(self):\n        return self.celsius * 9 / 5 + 32", tests: [["Temperature(100).to_fahrenheit()", "212.0"], ["Temperature(0).to_fahrenheit()", "32.0"], ["Temperature(-40).to_fahrenheit()", "-40.0"]], why: "Store the Celsius value, and compute the Fahrenheit value in the method." },
      ] },
  ] });
})(typeof window !== "undefined" ? window : globalThis);
