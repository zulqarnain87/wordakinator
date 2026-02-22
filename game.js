// ============================================
// MINI-AKINATOR GAME ENGINE v2.0
// ============================================
// 1️⃣ STATE MANAGER
// ============================================
const GameState = {
    INIT: "init",
    CATEGORY_QUESTION: "category_question",
    SUBCATEGORY_QUESTION: "subcategory_question",
    GUESSING: "guessing",
    HINT: "hint",
    RESULT: "result"
};

// ============================================
// 2️⃣ DATA LOADING
// ============================================
let categoryData = null;

async function loadCategoryData() {
    try {
        if (categoryData) {
            console.log("Category data already loaded");
            return categoryData;
        }

        console.log("Fetching data.json...");
        const response = await fetch("data.json");
        if (!response.ok) {
            throw new Error(`Failed to load data.json: ${response.status} ${response.statusText}`);
        }
        
        categoryData = await response.json();
        console.log("Category data loaded successfully", Object.keys(categoryData).length, "categories");
        
        applyStoredPriorities();
        return categoryData;
    } catch (error) {
        console.error("Error loading category data:", error);
        alert("Failed to load game data: " + error.message);
        return null;
    }
}

// ============================================
// 3️⃣ PRIORITY & LEARNING SYSTEM (LocalStorage)
// ============================================
const PRIORITY_KEY = "miniAkinatorPriorities";
const SCORE_KEY = "miniAkinatorScore";

function loadPriorities() {
    const stored = localStorage.getItem(PRIORITY_KEY);
    return stored ? JSON.parse(stored) : {};
}

function savePriorities() {
    const priorities = {};
    Object.entries(categoryData).forEach(([catId, category]) => {
        priorities[catId] = category.priority;
        Object.entries(category.subcategories).forEach(([subId, sub]) => {
            priorities[`${catId}.${subId}`] = sub.priority;
        });
    });
    localStorage.setItem(PRIORITY_KEY, JSON.stringify(priorities));
}

function applyStoredPriorities() {
    if (!categoryData) return;
    const stored = loadPriorities();
    Object.entries(categoryData).forEach(([catId, category]) => {
        if (stored[catId]) category.priority = stored[catId];
        Object.entries(category.subcategories).forEach(([subId, sub]) => {
            if (stored[`${catId}.${subId}`]) sub.priority = stored[`${catId}.${subId}`];
        });
    });
}

function getScore() {
    const score = localStorage.getItem(SCORE_KEY);
    return score ? parseInt(score) : 0;
}

function setScore(score) {
    localStorage.setItem(SCORE_KEY, score.toString());
}

function updateScore(delta) {
    const current = getScore();
    setScore(current + delta);
}

// ============================================
// 4️⃣ GAME STATE VARIABLES
// ============================================
let gameState = GameState.INIT;
let categoryQuestions = [];
let subcategoryQuestions = [];
let currentCategoryIdx = 0;
let currentSubcategoryIdx = 0;
let selectedCategoryId = null;
let selectedSubcategoryId = null;
let availableWords = [];
let currentGuess = null;
let guessesLeft = 3;
let hintLetter = null;
let agentWon = false;

// ============================================
// 5️⃣ CATEGORY SORTING & FILTERING
// ============================================
function getSortedCategories() {
    return Object.entries(categoryData)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.priority - a.priority);
}

function getSortedSubcategories(categoryId) {
    const category = categoryData[categoryId];
    if (!category) return [];
    return Object.entries(category.subcategories)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.priority - a.priority);
}

function wordExists(word) {
    for (const category of Object.values(categoryData)) {
        for (const subcategory of Object.values(category.subcategories)) {
            if (subcategory.words.map(w => w.toLowerCase()).includes(word.toLowerCase())) {
                return true;
            }
        }
    }
    return false;
}

// ============================================
// 6️⃣ WORD GUESSING LOGIC
// ============================================
function pickNextGuess() {
    if (!availableWords || availableWords.length === 0) {
        return null;
    }
    const idx = Math.floor(Math.random() * availableWords.length);
    return availableWords[idx];
}

function applyHintFilter(letter) {
    return availableWords.filter(word => word[2] === letter);
}

// ============================================
// 7️⃣ UI RENDERING
// ============================================
const content = document.getElementById("content");

function renderInitScreen() {
    content.innerHTML = `
        <div class="card-header">🧠 Mini-Akinator</div>
        <div class="start-screen">
            <h1>Word Guessing Game</h1>
            <p>Think of a word (<strong>from Supported Words</strong>).</p>
            <p>Click <strong>Done</strong> when you're ready.</p>
            <button class="btn-start" onclick="startGame()">Done</button>
            <p style="margin-top: 20px; font-size: 14px; color: #95a5a6;">Score: ${getScore()}</p>
        </div>
    `;
}

function renderCategoryQuestion() {
    const question = categoryQuestions[currentCategoryIdx];
    if (!question) {
        moveToGuessing();
        return;
    }

    content.innerHTML = `
        <div class="card-header">🧠 Mini-Akinator</div>
        <div class="question-container">
            <div class="question-number">Category Question ${currentCategoryIdx + 1} of ${categoryQuestions.length}</div>
            <div class="question-text">${question.label}</div>
            <button class="btn-yesno yes" onclick="answerCategoryQuestion(true)">✓ Yes</button>
            <button class="btn-yesno no" onclick="answerCategoryQuestion(false)">✗ No</button>
        </div>
    `;
}

function renderSubcategoryQuestion() {
    const question = subcategoryQuestions[currentSubcategoryIdx];
    if (!question) {
        moveToGuessing();
        return;
    }

    content.innerHTML = `
        <div class="card-header">🧠 Mini-Akinator</div>
        <div class="question-container">
            <div class="question-number">Subcategory Question ${currentSubcategoryIdx + 1} of ${subcategoryQuestions.length}</div>
            <div class="question-text">${question.label}</div>
            <button class="btn-yesno yes" onclick="answerSubcategoryQuestion(true)">✓ Yes</button>
            <button class="btn-yesno no" onclick="answerSubcategoryQuestion(false)">✗ No</button>
        </div>
    `;
}

function renderGuessingScreen() {
    if (!currentGuess) {
        currentGuess = pickNextGuess();
    }

    if (!currentGuess) {
        // No words available
        content.innerHTML = `
            <div class="card-header">🧠 Mini-Akinator</div>
            <div class="result-container">
                <div class="result-emoji">😔</div>
                <div class="result-title">No Words Available</div>
                <div class="result-message">There are no words matching your description.</div>
                <button class="btn-replay" onclick="resetGame()">🔄 Play Again</button>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="card-header">🎯 My Guess</div>
        <div class="guess-container">
            <div class="guess-text">Is it...</div>
            <div class="guess-card pop">${currentGuess.toUpperCase()}</div>
            <button class="btn-answer btn-correct" onclick="markCorrect()">✓ Correct!</button>
            <button class="btn-answer btn-wrong" onclick="markWrong()">✗ Wrong</button>
            ${guessesLeft <= 0 ? `<button class="btn-answer btn-hint" onclick="askForHint()">💡 Need a Hint</button>` : ''}
            <div class="guesses-left">Guesses left: ${guessesLeft}</div>
        </div>
    `;
}

function renderHintScreen() {
    content.innerHTML = `
        <div class="card-header">💡 Hint</div>
        <div class="question-container" style="text-align: center;">
            <div class="question-text">What is the 3rd letter of your word?</div>
            <input type="text" class="hint-input" id="hintInput" maxlength="1" placeholder="Enter letter" autofocus>
            <button class="btn-answer btn-hint" onclick="submitHint()" style="margin-top: 15px;">Submit</button>
            <button class="btn-answer btn-give-up" onclick="giveUp()" style="margin-top: 10px;">🏳️ Give Up</button>
        </div>
    `;
    setTimeout(() => document.getElementById("hintInput").focus(), 300);
}

function renderResultScreen(won, finalWord) {
    const emoji = won ? "🎉" : "😔";
    const title = won ? "🎉 I Won!" : "😔 You Win";
    const score = getScore();

    let message = "";
    if (won) {
        message = "I successfully guessed your word!";
    } else {
        if (wordExists(finalWord)) {
            message = `The word was <strong>${finalWord.toUpperCase()}</strong>. Well done!`;
        } else {
            message = `<span class="error-message">This word is not supported.</span>`;
        }
    }

    content.innerHTML = `
        <div class="card-header">🧠 Mini-Akinator</div>
        <div class="result-container">
            <div class="result-emoji">${emoji}</div>
            <div class="result-title">${title}</div>
            <div class="result-message">${message}</div>
            <div style="font-size: 16px; color: var(--primary); font-weight: bold; margin-bottom: 20px;">Score: ${score}</div>
            <button class="btn-replay" onclick="resetGame()">🔄 Play Again</button>
        </div>
    `;
}

// ============================================
// 8️⃣ GAME FLOW FUNCTIONS
// ============================================
async function startGame() {
    // Ensure categoryData is loaded
    if (!categoryData) {
        console.log("Loading category data...");
        await loadCategoryData();
    }

    if (!categoryData) {
        alert("Failed to load game data. Please refresh the page.");
        return;
    }

    gameState = GameState.CATEGORY_QUESTION;
    categoryQuestions = getSortedCategories();
    currentCategoryIdx = 0;
    selectedCategoryId = null;
    selectedSubcategoryId = null;
    availableWords = [];
    guessesLeft = 3;
    hintLetter = null;
    currentGuess = null;
    agentWon = false;

    renderCategoryQuestion();
}

function answerCategoryQuestion(answer) {
    const category = categoryQuestions[currentCategoryIdx];

    if (answer) {
        // YES: Jump to subcategories
        selectedCategoryId = category.id;
        subcategoryQuestions = getSortedSubcategories(category.id);
        currentSubcategoryIdx = 0;

        // Update priority
        categoryData[category.id].priority++;
        savePriorities();

        gameState = GameState.SUBCATEGORY_QUESTION;
        renderSubcategoryQuestion();
    } else {
        // NO: Move to next category
        currentCategoryIdx++;
        if (currentCategoryIdx >= categoryQuestions.length) {
            // No more categories, go to guessing
            moveToGuessing();
        } else {
            renderCategoryQuestion();
        }
    }
}

function answerSubcategoryQuestion(answer) {
    const subcategory = subcategoryQuestions[currentSubcategoryIdx];

    if (answer) {
        // YES: Select this subcategory and move to guessing
        selectedSubcategoryId = subcategory.id;
        availableWords = categoryData[selectedCategoryId].subcategories[subcategory.id].words
            .map(w => w.toLowerCase());

        // Update priority
        categoryData[selectedCategoryId].subcategories[subcategory.id].priority++;
        savePriorities();

        moveToGuessing();
    } else {
        // NO: Move to next subcategory
        currentSubcategoryIdx++;
        if (currentSubcategoryIdx >= subcategoryQuestions.length) {
            // No more subcategories, go to guessing
            moveToGuessing();
        } else {
            renderSubcategoryQuestion();
        }
    }
}

function moveToGuessing() {
    gameState = GameState.GUESSING;
    guessesLeft = 3;
    currentGuess = null;
    hintLetter = null;
    renderGuessingScreen();
}

function markCorrect() {
    agentWon = true;
    updateScore(-1); // Agent won = user loses 1 point
    gameState = GameState.RESULT;
    renderResultScreen(true, currentGuess);
}

function markWrong() {
    guessesLeft--;

    if (guessesLeft > 0) {
        currentGuess = pickNextGuess();
        if (!currentGuess) {
            // No more words available
            gameState = GameState.HINT;
            renderHintScreen();
        } else {
            renderGuessingScreen();
        }
    } else {
        // Out of guesses, ask for hint
        gameState = GameState.HINT;
        renderHintScreen();
    }
}

function askForHint() {
    gameState = GameState.HINT;
    renderHintScreen();
}

function submitHint() {
    const input = document.getElementById("hintInput").value.toLowerCase();

    if (!input || input.length !== 1) {
        alert("Please enter a single letter");
        return;
    }

    hintLetter = input;
    availableWords = applyHintFilter(input);

    if (availableWords.length === 0) {
        // No words match the hint
        alert("No words match that letter. Try again.");
        renderHintScreen();
        return;
    }

    // Reset guesses and go back to guessing
    guessesLeft = 3;
    currentGuess = null;
    gameState = GameState.GUESSING;
    renderGuessingScreen();
}

function giveUp() {
    gameState = GameState.RESULT;

    const modalBody = document.getElementById("giveUpInput");
    if (modalBody) {
        const userWord = modalBody.value.toLowerCase().trim();
        if (userWord && userWord.length === 4) {
            if (wordExists(userWord)) {
                updateScore(1); // User wins 1 point
                renderResultScreen(false, userWord);
            } else {
                renderResultScreen(false, userWord);
            }
            return;
        }
    }

    // Show give up dialog
    content.innerHTML = `
        <div class="card-header">🏳️ Give Up</div>
        <div class="question-container" style="text-align: center;">
            <div class="question-text">What was the word you were thinking of?</div>
            <input type="text" class="hint-input" id="giveUpInput" maxlength="4" placeholder="Enter 4-letter word" autofocus>
            <button class="btn-answer btn-correct" onclick="giveUp()" style="margin-top: 15px;">Submit</button>
        </div>
    `;
    setTimeout(() => document.getElementById("giveUpInput").focus(), 300);
}

function resetGame() {
    gameState = GameState.INIT;
    renderInitScreen();
}

// ============================================
// 9️⃣ INITIALIZATION
// ============================================

// Initialize when DOM is ready
function initGame() {
    loadCategoryData().then(() => {
        renderInitScreen();
    }).catch(error => {
        console.error("Failed to initialize game:", error);
        alert("Error loading game. Please refresh the page.");
    });
}

// Run initialization once DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGame);
} else {
    // DOM is already loaded
    initGame();
}

