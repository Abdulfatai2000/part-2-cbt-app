// ========== GLOBAL VARIABLES ==========
let currentCourse = null;
let currentQuestions = [];
let selectedQuestions = [];
let userAnswers = [];
let currentIndex = 0;
let timerInterval = null;
let timeRemainingSeconds = 0;
let testActive = false;
let totalTimeSeconds = 0;

// DOM Elements
const setupScreen = document.getElementById('setupScreen');
const testScreen = document.getElementById('testScreen');
const resultScreen = document.getElementById('resultScreen');
const courseSelect = document.getElementById('courseSelect');
const questionCountInput = document.getElementById('questionCount');
const maxQuestionsSpan = document.getElementById('maxQuestions');
const minutesInput = document.getElementById('minutesInput');
const secondsInput = document.getElementById('secondsInput');
const startBtn = document.getElementById('startBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyListDiv = document.getElementById('historyList');

// Test screen elements
const testCourseName = document.getElementById('testCourseName');
const timerDisplay = document.getElementById('timerDisplay');
const currentQSpan = document.getElementById('currentQ');
const totalQSpan = document.getElementById('totalQ');
const answeredCountSpan = document.getElementById('answeredCount');
const questionText = document.getElementById('questionText');
const optionsList = document.getElementById('optionsList');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitTestBtn = document.getElementById('submitTestBtn');

// Result screen elements
const scoreCircle = document.getElementById('scoreCircle');
const scoreDetail = document.getElementById('scoreDetail');
const wrongList = document.getElementById('wrongList');
const newTestBtn = document.getElementById('newTestBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');

// ========== HISTORY MANAGEMENT ==========
function getHistoryKey(courseId) {
    return `cbt_history_${courseId}`;
}

function getHistory(courseId) {
    const key = getHistoryKey(courseId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
}

function addHistoryEntry(courseId, courseName, score, total, percentage, date) {
    const history = getHistory(courseId);
    history.unshift({
        date: date || new Date().toLocaleString(),
        score: score,
        total: total,
        percentage: percentage
    });
    // Keep only last 20 entries
    if (history.length > 20) history.pop();
    localStorage.setItem(getHistoryKey(courseId), JSON.stringify(history));
    displayHistory(courseId);
}

function displayHistory(courseId) {
    if (!courseId) {
        historyListDiv.innerHTML = '<p class="empty-history">Select a course to see past scores</p>';
        return;
    }
    const history = getHistory(courseId);
    if (history.length === 0) {
        historyListDiv.innerHTML = '<p class="empty-history">No attempts yet. Start a test!</p>';
        return;
    }
    historyListDiv.innerHTML = history.map(entry => `
        <div class="history-item">
            <span>${entry.date}</span>
            <span><strong>${entry.score}/${entry.total}</strong> (${entry.percentage}%)</span>
        </div>
    `).join('');
}

function clearAllHistory() {
    const courses = ['MTH202', 'STT202', 'CPE204', 'CPE206', 'CSC202', 'CIS212', 'SEN212', 'SEN214', 'SEN216'];
    courses.forEach(course => {
        localStorage.removeItem(getHistoryKey(course));
    });
    if (courseSelect.value) {
        displayHistory(courseSelect.value);
    } else {
        historyListDiv.innerHTML = '<p class="empty-history">Select a course to see past scores</p>';
    }
    alert('All history cleared!');
}

// ========== LOAD COURSE DATA ==========
async function loadCourseData(courseId) {
    try {
        const response = await fetch(`data/${courseId}.json`);
        if (!response.ok) throw new Error('Course file not found');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        alert(`⚠️ Course file not found: data/${courseId}.json\n\nPlease create this file with your questions first.`);
        return null;
    }
}

// ========== SHUFFLE & SELECT QUESTIONS ==========
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function selectRandomQuestions(allQuestions, count) {
    const shuffled = shuffleArray([...allQuestions]);
    return shuffled.slice(0, count);
}

// ========== START TEST ==========
startBtn.addEventListener('click', async () => {
    const courseId = courseSelect.value;
    if (!courseId) {
        alert('Please select a course');
        return;
    }
    
    // Add4 validation
    const isValid = await validateQuestionCount();
    if (!isValid) {
        // Scroll to warning
        document.getElementById('questionWarning').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    const questionCount = parseInt(questionCountInput.value);
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;

    if (isNaN(questionCount) || questionCount < 1) {
        alert('Please enter a valid number of questions');
        return;
    }

    if (minutes === 0 && seconds === 0) {
        alert('Please set a time greater than 0');
        return;
    }

    // Load course data
    const courseData = await loadCourseData(courseId);
    if (!courseData) return;

    const allQuestionsData = courseData.questions;
    if (!allQuestionsData || allQuestionsData.length === 0) {
        alert('This course has no questions. Please add questions to the JSON file first.');
        return;
    }

    if (questionCount > allQuestionsData.length) {
        alert(`You can only select up to ${allQuestionsData.length} questions for this course.`);
        return;
    }

    // Setup test
    currentCourse = {
        id: courseId,
        name: courseData.courseName || courseId
    };
    currentQuestions = allQuestionsData;
    selectedQuestions = selectRandomQuestions(currentQuestions, questionCount);
    userAnswers = new Array(selectedQuestions.length).fill(null);
    currentIndex = 0;
    
    // Setup timer
    totalTimeSeconds = (minutes * 60) + seconds;
    timeRemainingSeconds = totalTimeSeconds;
    updateTimerDisplay();
    
    testActive = true;
    
    // Switch screens
    setupScreen.classList.remove('active');
    testScreen.classList.add('active');
    
    // Update UI
    testCourseName.textContent = currentCourse.name;
    totalQSpan.textContent = selectedQuestions.length;
    
    // Start timer
    startTimer();
    
    // Load first question
    loadQuestion();
});

// ========== TIMER FUNCTIONS ==========
function updateTimerDisplay() {
    const hours = Math.floor(timeRemainingSeconds / 3600);
    const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
    const seconds = timeRemainingSeconds % 60;
    timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Warning when 10% time left
    if (timeRemainingSeconds <= totalTimeSeconds * 0.1 && timeRemainingSeconds > 0) {
        timerDisplay.style.background = '#fee2e2';
        timerDisplay.style.color = '#dc2626';
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!testActive) return;
        
        if (timeRemainingSeconds <= 0) {
            // Time's up
            clearInterval(timerInterval);
            alert('⏰ Time is up! Submitting your test.');
            finishTest();
        } else {
            timeRemainingSeconds--;
            updateTimerDisplay();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ========== LOAD QUESTION ==========
function loadQuestion() {
    if (!testActive) return;
    
    const q = selectedQuestions[currentIndex];
    questionText.textContent = `${currentIndex + 1}. ${q.text}`;
    
    // Generate options HTML
    let optionsHtml = '';
    q.options.forEach((opt, idx) => {
        const isChecked = userAnswers[currentIndex] === idx;
        const checkedAttr = isChecked ? 'checked' : '';
        optionsHtml += `
            <div class="option" data-opt-index="${idx}">
                <input type="radio" name="questionOption" value="${idx}" id="opt_${idx}" ${checkedAttr}>
                <label for="opt_${idx}" class="option-text">${opt}</label>
            </div>
        `;
    });
    optionsList.innerHTML = optionsHtml;
    
    // Add click listeners to option divs
    document.querySelectorAll('.option').forEach(div => {
        const radio = div.querySelector('input[type="radio"]');
        div.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                if (radio) radio.checked = true;
                const changeEvent = new Event('change', { bubbles: true });
                if (radio) radio.dispatchEvent(changeEvent);
            }
        });
    });
    
    // Add change listeners to radios
    const radios = document.querySelectorAll('input[name="questionOption"]');
    radios.forEach(radio => {
        radio.removeEventListener('change', handleRadioChange);
        radio.addEventListener('change', handleRadioChange);
    });
    
    // Update counters
    currentQSpan.textContent = currentIndex + 1;
    updateAnsweredCounter();
}

function handleRadioChange(e) {
    if (!testActive) return;
    const selectedVal = parseInt(e.target.value);
    if (!isNaN(selectedVal)) {
        userAnswers[currentIndex] = selectedVal;
        updateAnsweredCounter();
    }
}

function updateAnsweredCounter() {
    const answered = userAnswers.filter(a => a !== null).length;
    answeredCountSpan.textContent = answered;
}

// ========== NAVIGATION ==========
prevBtn.addEventListener('click', () => {
    if (!testActive) return;
    if (currentIndex > 0) {
        currentIndex--;
        loadQuestion();
    }
});

nextBtn.addEventListener('click', () => {
    if (!testActive) return;
    if (currentIndex < selectedQuestions.length - 1) {
        currentIndex++;
        loadQuestion();
    } else {
        // Last question - ask to submit
        if (userAnswers[currentIndex] === null) {
            if (confirm('You haven\'t answered the last question. Submit anyway?')) {
                finishTest();
            }
        } else {
            finishTest();
        }
    }
});

submitTestBtn.addEventListener('click', () => {
    const unanswered = userAnswers.filter(a => a === null).length;
    if (unanswered > 0) {
        if (confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) {
            finishTest();
        }
    } else {
        finishTest();
    }
});

// ========== FINISH TEST & SHOW RESULTS ==========
function finishTest() {
    if (!testActive) return;
    testActive = false;
    stopTimer();
    
    // Calculate score
    let correctCount = 0;
    const wrongAnswersList = [];
    
    for (let i = 0; i < selectedQuestions.length; i++) {
        const userAns = userAnswers[i];
        const correctAns = selectedQuestions[i].correct;
        if (userAns !== null && userAns === correctAns) {
            correctCount++;
        } else {
            wrongAnswersList.push({
                question: selectedQuestions[i].text,
                correctAnswer: selectedQuestions[i].options[selectedQuestions[i].correct],
                userAnswer: userAns !== null ? selectedQuestions[i].options[userAns] : 'No answer',
                correctIndex: selectedQuestions[i].correct
            });
        }
    }
    
    const percentage = Math.round((correctCount / selectedQuestions.length) * 100);
    
    // Save to history
    addHistoryEntry(
        currentCourse.id,
        currentCourse.name,
        correctCount,
        selectedQuestions.length,
        percentage,
        new Date().toLocaleString()
    );
    
    // Show results
    scoreCircle.textContent = `${percentage}%`;
    scoreDetail.textContent = `${correctCount} / ${selectedQuestions.length} correct`;
    
    // Display wrong answers
    if (wrongAnswersList.length === 0) {
        wrongList.innerHTML = '<p style="color: #059669;">🎉 Perfect! No wrong answers!</p>';
    } else {
        wrongList.innerHTML = wrongAnswersList.map(w => `
            <div class="wrong-item">
                <div class="wrong-question">❓ ${w.question}</div>
                <div>Your answer: ${w.userAnswer}</div>
                <div class="correct-answer">✓ Correct answer: ${w.correctAnswer}</div>
            </div>
        `).join('');
    }
    
    // Switch to result screen
    testScreen.classList.remove('active');
    resultScreen.classList.add('active');
}

// ========== RESET & NEW TEST ==========
newTestBtn.addEventListener('click', () => {
    // Reset everything
    stopTimer();
    testActive = false;
    resultScreen.classList.remove('active');
    setupScreen.classList.add('active');
    currentCourse = null;
    selectedQuestions = [];
    userAnswers = [];
    
    // Reset timer display style
    timerDisplay.style.background = '';
    timerDisplay.style.color = '';
});

viewHistoryBtn.addEventListener('click', () => {
    resultScreen.classList.remove('active');
    setupScreen.classList.add('active');
    if (currentCourse) {
        courseSelect.value = currentCourse.id;
        displayHistory(currentCourse.id);
        updateMaxQuestions();
    }
});

// ========== HELPER FUNCTIONS ==========
courseSelect.addEventListener('change', async () => {
    const courseId = courseSelect.value;
    if (courseId) {
        displayHistory(courseId);
        await updateMaxQuestions();
    } else {
        historyListDiv.innerHTML = '<p class="empty-history">Select a course to see past scores</p>';
        maxQuestionsSpan.textContent = '0';
    }
});

async function validateQuestionCount() {
    const courseId = courseSelect.value;
    const questionCount = parseInt(questionCountInput.value);
    const warningSpan = document.getElementById('questionWarning');
    
    if (!courseId) {
        warningSpan.style.display = 'none';
        return true;
    }
    
    try {
        const response = await fetch(`data/${courseId}.json`);
        if (response.ok) {
            const data = await response.json();
            const maxQ = data.questions ? data.questions.length : 0;
            
            if (questionCount > maxQ) {
                warningSpan.textContent = `⚠️ You only have ${maxQ} question(s) available for this course. Please enter a number between 1 and ${maxQ}.`;
                warningSpan.style.display = 'block';
                return false;
            } else if (questionCount < 1) {
                warningSpan.textContent = `⚠️ Please enter at least 1 question.`;
                warningSpan.style.display = 'block';
                return false;
            } else {
                warningSpan.style.display = 'none';
                return true;
            }
        } else {
            warningSpan.textContent = `⚠️ Course data not found. Please create data/${courseId}.json file.`;
            warningSpan.style.display = 'block';
            return false;
        }
    } catch (error) {
        warningSpan.textContent = `⚠️ Error loading course data.`;
        warningSpan.style.display = 'block';
        return false;
    }
}

questionCountInput.addEventListener('input', function() {
    validateQuestionCount();
});

courseSelect.addEventListener('change', async function() {
    // ... your existing code ...
    await validateQuestionCount(); // Add this line
});

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL history for ALL courses?')) {
        clearAllHistory();
    }
});

// Initialize
updateMaxQuestions();
displayHistory('');
