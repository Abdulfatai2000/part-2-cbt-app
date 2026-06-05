// ========== CBT MASTERY APP ==========
// Refactored & Optimized Version

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
const scoreDetail = document.getElementById('scoreDetail');
const wrongList = document.getElementById('wrongList');
const newTestBtn = document.getElementById('newTestBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');

// Modal elements
const modal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

let modalResolve = null;

// ========== CUSTOM MODAL FUNCTIONS ==========
function showConfirm(message, title = "Confirm Action", icon = "❓") {
    return new Promise((resolve) => {
        modalResolve = resolve;
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'flex';
        
        const onConfirm = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(true);
        };
        
        const onCancel = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(false);
        };
        
        const cleanup = () => {
            modalConfirmBtn.removeEventListener('click', onConfirm);
            modalCancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onOverlay);
        };
        
        const onOverlay = (e) => {
            if (e.target === modal) onCancel();
        };
        
        modalConfirmBtn.addEventListener('click', onConfirm);
        modalCancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onOverlay);
    });
}

function showAlert(message, title = "Notice") {
    return showConfirm(message, title, "ℹ️");
}

// ========== HISTORY MANAGEMENT ==========
function getHistoryKey(courseId) {
    return `cbt_history_${courseId}`;
}

function getHistory(courseId) {
    const stored = localStorage.getItem(getHistoryKey(courseId));
    return stored ? JSON.parse(stored) : [];
}

function addHistoryEntry(courseId, courseName, score, total, percentage) {
    const history = getHistory(courseId);
    history.unshift({
        date: new Date().toLocaleString(),
        score: score,
        total: total,
        percentage: percentage
    });
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
}

// ========== LOAD COURSE DATA (with fallback) ==========
async function loadCourseData(courseId) {
    try {
        const response = await fetch(`data/${courseId}.json`);
        if (!response.ok) throw new Error('Course file not found');
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn('Using fallback data for:', courseId);
        return {
            courseName: courseId,
            questions: [
                { text: "What is the capital of Nigeria?", options: ["Lagos", "Abuja", "Kano", "Ibadan"], correct: 1 },
                { text: "What does CPU stand for?", options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Utility"], correct: 0 },
                { text: "Which protocol is used for web browsing?", options: ["FTP", "SMTP", "HTTP", "POP3"], correct: 2 },
                { text: "What does RAM stand for?", options: ["Readily Available Memory", "Random Access Memory", "Rapid Access Module", "Read Access Memory"], correct: 1 },
                { text: "What is 2 + 2?", options: ["3", "4", "5", "6"], correct: 1 },
                { text: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"], correct: 0 },
                { text: "What is the function of a router?", options: ["Connect networks and route data", "Store files", "Display web pages", "Process word documents"], correct: 0 }
            ]
        };
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function selectRandomQuestions(allQuestions, count) {
    return shuffleArray([...allQuestions]).slice(0, count);
}

// ========== VALIDATION ==========
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
            const maxQ = data.questions ? data.questions.length : 7;
            if (questionCount > maxQ) {
                warningSpan.textContent = `⚠️ Only ${maxQ} questions available. Please enter 1-${maxQ}.`;
                warningSpan.style.display = 'block';
                return false;
            } else if (questionCount < 1) {
                warningSpan.textContent = `⚠️ Please enter at least 1 question.`;
                warningSpan.style.display = 'block';
                return false;
            }
        }
        warningSpan.style.display = 'none';
        return true;
    } catch {
        warningSpan.style.display = 'none';
        return true;
    }
}

// ========== TIMER FUNCTIONS ==========
function updateTimerDisplay() {
    const hours = Math.floor(timeRemainingSeconds / 3600);
    const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
    const seconds = timeRemainingSeconds % 60;
    timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeRemainingSeconds <= totalTimeSeconds * 0.1 && timeRemainingSeconds > 0) {
        timerDisplay.classList.add('warning');
    } else {
        timerDisplay.classList.remove('warning');
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!testActive) return;
        if (timeRemainingSeconds <= 0) {
            clearInterval(timerInterval);
            showAlert('⏰ Time is up! Submitting your test.', 'Time\'s Up').then(() => finishTest());
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

// ========== QUESTION FUNCTIONS ==========
function updateAnsweredCounter() {
    const answered = userAnswers.filter(a => a !== null).length;
    answeredCountSpan.textContent = answered;
}

function handleRadioChange(e) {
    if (!testActive) return;
    const selectedVal = parseInt(e.target.value);
    if (!isNaN(selectedVal)) {
        userAnswers[currentIndex] = selectedVal;
        updateAnsweredCounter();
    }
}

function loadQuestion() {
    if (!testActive) return;
    const q = selectedQuestions[currentIndex];
    questionText.textContent = `${currentIndex + 1}. ${q.text}`;
    
    let optionsHtml = '';
    q.options.forEach((opt, idx) => {
        const isChecked = userAnswers[currentIndex] === idx;
        optionsHtml += `
            <div class="option" data-opt-index="${idx}">
                <input type="radio" name="questionOption" value="${idx}" id="opt_${idx}" ${isChecked ? 'checked' : ''}>
                <label for="opt_${idx}" class="option-text">${opt}</label>
            </div>
        `;
    });
    optionsList.innerHTML = optionsHtml;
    
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
    
    const radios = document.querySelectorAll('input[name="questionOption"]');
    radios.forEach(radio => {
        radio.removeEventListener('change', handleRadioChange);
        radio.addEventListener('change', handleRadioChange);
    });
    
    currentQSpan.textContent = currentIndex + 1;
    updateAnsweredCounter();
}

// ========== PIE CHART ==========
function drawPieChart(correct, wrong) {
    const canvas = document.getElementById('scorePieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = correct + wrong;
    canvas.width = 400;
    canvas.height = 400;
    ctx.clearRect(0, 0, 400, 400);
    if (total === 0) return;
    
    let startAngle = -90 * Math.PI / 180;
    
    if (correct > 0) {
        const correctAngle = (correct / total) * 360 * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(200, 200);
        ctx.arc(200, 200, 180, startAngle, startAngle + correctAngle);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        startAngle += correctAngle;
    }
    
    if (wrong > 0) {
        const wrongAngle = (wrong / total) * 360 * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(200, 200);
        ctx.arc(200, 200, 180, startAngle, startAngle + wrongAngle);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
    }
    
    ctx.beginPath();
    ctx.arc(200, 200, 100, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(200, 200, 180, 0, 2 * Math.PI);
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 3;
    ctx.stroke();
}

// ========== FINISH TEST ==========
async function finishTest() {
    if (!testActive) return;
    testActive = false;
    stopTimer();
    
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
                userAnswer: userAns !== null ? selectedQuestions[i].options[userAns] : 'No answer'
            });
        }
    }
    
    const percentage = Math.round((correctCount / selectedQuestions.length) * 100);
    const wrongCount = selectedQuestions.length - correctCount;
    
    addHistoryEntry(currentCourse.id, currentCourse.name, correctCount, selectedQuestions.length, percentage);
    
    drawPieChart(correctCount, wrongCount);
    document.getElementById('piePercentage').textContent = `${percentage}%`;
    document.getElementById('correctTotal').textContent = correctCount;
    document.getElementById('wrongTotal').textContent = wrongCount;
    scoreDetail.textContent = `${correctCount} / ${selectedQuestions.length} correct`;
    
    if (wrongAnswersList.length === 0) {
        wrongList.innerHTML = '<p style="color: #10b981; text-align: center; padding: 20px;">🎉 Perfect! No wrong answers! 🎉</p>';
    } else {
        wrongList.innerHTML = wrongAnswersList.map(w => `
            <div class="wrong-item">
                <div class="wrong-question">❓ ${w.question}</div>
                <div>Your answer: ${w.userAnswer}</div>
                <div class="correct-answer">✓ Correct: ${w.correctAnswer}</div>
            </div>
        `).join('');
    }
    
    testScreen.classList.remove('active');
    resultScreen.classList.add('active');
}

// ========== EVENT LISTENERS ==========
startBtn.addEventListener('click', async () => {
    const courseId = courseSelect.value;
    if (!courseId) {
        await showAlert('Please select a course', 'No Course Selected');
        return;
    }
    
    const isValid = await validateQuestionCount();
    if (!isValid) return;
    
    const questionCount = parseInt(questionCountInput.value);
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;
    
    if (isNaN(questionCount) || questionCount < 1) {
        await showAlert('Please enter a valid number of questions', 'Invalid Input');
        return;
    }
    
    if (minutes === 0 && seconds === 0) {
        await showAlert('Please set a time greater than 0', 'Invalid Time');
        return;
    }
    
    const courseData = await loadCourseData(courseId);
    if (!courseData) return;
    
    const allQuestionsData = courseData.questions;
    if (!allQuestionsData || allQuestionsData.length === 0) {
        await showAlert('This course has no questions.', 'No Questions');
        return;
    }
    
    if (questionCount > allQuestionsData.length) {
        await showAlert(`You can only select up to ${allQuestionsData.length} questions.`, 'Too Many Questions');
        return;
    }
    
    currentCourse = { id: courseId, name: courseData.courseName || courseId };
    currentQuestions = allQuestionsData;
    selectedQuestions = selectRandomQuestions(currentQuestions, questionCount);
    userAnswers = new Array(selectedQuestions.length).fill(null);
    currentIndex = 0;
    
    totalTimeSeconds = (minutes * 60) + seconds;
    timeRemainingSeconds = totalTimeSeconds;
    updateTimerDisplay();
    
    testActive = true;
    setupScreen.classList.remove('active');
    testScreen.classList.add('active');
    testCourseName.textContent = currentCourse.name;
    totalQSpan.textContent = selectedQuestions.length;
    
    startTimer();
    loadQuestion();
});

prevBtn.addEventListener('click', () => {
    if (!testActive) return;
    if (currentIndex > 0) {
        currentIndex--;
        loadQuestion();
    }
});

nextBtn.addEventListener('click', async () => {
    if (!testActive) return;
    if (currentIndex < selectedQuestions.length - 1) {
        currentIndex++;
        loadQuestion();
    } else {
        if (userAnswers[currentIndex] === null) {
            const confirmed = await showConfirm('You haven\'t answered the last question. Submit anyway?', 'Unanswered Question');
            if (confirmed) finishTest();
        } else {
            finishTest();
        }
    }
});

submitTestBtn.addEventListener('click', async () => {
    const unanswered = userAnswers.filter(a => a === null).length;
    if (unanswered > 0) {
        const confirmed = await showConfirm(`You have ${unanswered} unanswered question(s). Submit anyway?`, 'Unanswered Questions');
        if (confirmed) finishTest();
    } else {
        finishTest();
    }
});

newTestBtn.addEventListener('click', () => {
    stopTimer();
    testActive = false;
    resultScreen.classList.remove('active');
    setupScreen.classList.add('active');
    currentCourse = null;
    selectedQuestions = [];
    userAnswers = [];
    timerDisplay.classList.remove('warning');
});

viewHistoryBtn.addEventListener('click', () => {
    resultScreen.classList.remove('active');
    setupScreen.classList.add('active');
    if (currentCourse) {
        courseSelect.value = currentCourse.id;
        displayHistory(currentCourse.id);
    }
});

clearHistoryBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('Are you sure you want to clear ALL history for ALL courses? This cannot be undone!', 'Clear All History', '🗑️');
    if (confirmed) {
        clearAllHistory();
        await showAlert('All history cleared successfully!', 'History Cleared');
    }
});

courseSelect.addEventListener('change', async () => {
    const courseId = courseSelect.value;
    if (courseId) {
        displayHistory(courseId);
        await validateQuestionCount();
    } else {
        historyListDiv.innerHTML = '<p class="empty-history">Select a course to see past scores</p>';
    }
});

questionCountInput.addEventListener('input', () => validateQuestionCount());

// ========== KEYBOARD NAVIGATION ==========
document.addEventListener('keydown', (event) => {
    if (!testScreen.classList.contains('active') || !testActive) return;
    
    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentIndex > 0) {
            currentIndex--;
            loadQuestion();
        }
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentIndex < selectedQuestions.length - 1) {
            currentIndex++;
            loadQuestion();
        } else {
            if (userAnswers[currentIndex] === null) {
                showConfirm('You haven\'t answered the last question. Submit anyway?', 'Unanswered Question').then(confirmed => {
                    if (confirmed) finishTest();
                });
            } else {
                finishTest();
            }
        }
    } else if (event.key >= '1' && event.key <= '4') {
        event.preventDefault();
        const optionIndex = parseInt(event.key) - 1;
        const radio = document.querySelector(`input[name="questionOption"][value="${optionIndex}"]`);
        if (radio) {
            radio.checked = true;
            const changeEvent = new Event('change', { bubbles: true });
            radio.dispatchEvent(changeEvent);
        }
    }
});

// ========== INITIALIZE ==========
displayHistory('');