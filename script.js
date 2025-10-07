// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBz5V99SiEojvhGvhM4hUPScoHCZB8x3jY",
    authDomain: "studystudentplanner.firebaseapp.com",
    projectId: "studystudentplanner",
    databaseURL: "https://studystudentplanner-default-rtdb.firebaseio.com",
    storageBucket: "studystudentplanner.firebasestorage.app",
    messagingSenderId: "1062101526895",
    appId: "1:1062101526895:web:fc529a3338ea65588269a",
    measurementId: "G-CUPTL5CD51"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Current user data
let currentUser = null;
let userProfile = null;

// Task management - will be user-specific
let tasks = [];

// Calendar functionality
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


// Notification system start
let notifications = [];
let dueNotificationsChecked = false; // Flag to check due tasks only once per session

// Helper function to check if a task is due today or tomorrow
function isTaskDue(taskDateString) {
    const taskDate = new Date(taskDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Set task day to start of day for comparison
    const dueDay = new Date(taskDate);
    dueDay.setHours(0, 0, 0, 0);

    // Check if task is due today or tomorrow
    return dueDay.getTime() === today.getTime() || dueDay.getTime() === tomorrow.getTime();
}

// Function to add a new notification
function addNotification(type, taskName, taskDate = null) {
    let message = '';
    let category = '';
    
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    switch (type) {
        case 'added':
            message = `Task **${taskName}** was successfully added.`;
            category = 'added';
            break;
        case 'removed':
            message = `Task **${taskName}** was removed.`;
            category = 'removed';
            break;
        case 'due':
            const taskDueDay = new Date(taskDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Check if the due day is today or tomorrow for the message text
            const dueText = taskDueDay.toDateString() === today.toDateString() ? 'today' : 'tomorrow';
            message = `Task **${taskName}** is due ${dueText}.`;
            category = 'due';
            break;
        default:
            return;
    }

    const newNotification = {
        id: Date.now(),
        message: message,
        timestamp: formattedTime,
        category: category,
        read: false
    };

    // Add to the front of the array (newest first)
    notifications.unshift(newNotification);
    
    // Limit notification count
    if (notifications.length > 20) {
        notifications.pop();
    }
    
    renderNotifications();
}

// Function to render notifications and update the badge
function renderNotifications() {
    const notificationList = document.getElementById('notification-list');
    const notificationBadge = document.getElementById('notification-badge');
    
    if (!notificationList || !notificationBadge) return;

    // Filter to count unread notifications
    const unreadCount = notifications.filter(n => !n.read).length;

    // Update badge
    if (unreadCount > 0) {
        notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notificationBadge.classList.remove('hidden');
    } else {
        notificationBadge.textContent = 0;
        notificationBadge.classList.add('hidden');
    }

    // Update dropdown content
    notificationList.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<li class="empty-message">No new notifications.</li>';
        return;
    }

    notifications.forEach(notification => {
        const li = document.createElement('li');
        li.className = notification.read ? 'read' : 'unread';
        li.dataset.id = notification.id;
        
        // Replace **text** with styled span (task name)
        const formattedMessage = notification.message.replace(
            /\*\*(.*?)\*\*/g, 
            `<span class="notification-text type-${notification.category}">$1</span>`
        );
        
        li.innerHTML = `
            ${formattedMessage}
            <div class="notification-time">${notification.timestamp}</div>
        `;
        
        notificationList.appendChild(li);
    });
}

// Set up event listeners for buttons that exist on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set up navigation
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(navItem => navItem.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Show corresponding page
            const pageId = this.getAttribute('data-page');
            document.getElementById(pageId).classList.add('active');
            
            // Update the page content if needed
            if (pageId === 'calendar') {
                renderCalendar(currentMonth, currentYear);
            } else if (pageId === 'progress') {
                updateProgress();
            } else if (pageId === 'profile') {
                updateProfileDisplay();
            }
        });
    });

    // Set up calendar navigation
    document.getElementById('prev-month').addEventListener('click', function() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar(currentMonth, currentYear);
    });

    document.getElementById('next-month').addEventListener('click', function() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar(currentMonth, currentYear);
    });

    // Set up add task button
    document.getElementById('save-task').addEventListener('click', addTask);
    
    // Set up edit task button
    document.getElementById('save-edit-task').addEventListener('click', saveEditedTask);

    // Set up profile upload
    document.getElementById('profile-upload').addEventListener('change', uploadProfilePhoto);

    // Set up logout button
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Set up save profile button
    document.getElementById('save-profile').addEventListener('click', saveProfile);

    // Set up edit profile button
    document.getElementById('edit-profile').addEventListener('click', enableProfileEditing);

    // Initialize the app
    initApp();
    
    // Notification event listners
    const notificationBell = document.getElementById('notification-bell');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const clearNotificationsBtn = document.getElementById('clear-notifications-btn');

    if (notificationBell && notificationDropdown) {
        notificationBell.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click from closing it immediately
            const isVisible = notificationDropdown.classList.toggle('visible');
            notificationBell.setAttribute('aria-expanded', isVisible);
            
            // Mark all current unread notifications as read when the dropdown is opened
            if (isVisible) {
                notifications.filter(n => !n.read).forEach(n => n.read = true);
                renderNotifications();
            }
        });
    }

    // Clear all notifications button
    if (clearNotificationsBtn) {
        clearNotificationsBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            notifications = [];
            renderNotifications();
            notificationDropdown.classList.remove('visible');
            notificationBell.setAttribute('aria-expanded', 'false');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        // Check if the click is outside the bell button AND outside the dropdown
        if (notificationDropdown && notificationBell && !notificationBell.contains(event.target) && !notificationDropdown.contains(event.target)) {
            notificationDropdown.classList.remove('visible');
            notificationBell.setAttribute('aria-expanded', 'false');
        }
    });

    // Initial render call to ensure badge status is correct on load
    renderNotifications();
});

// Initialize the application with user data
function initApp() {
    // Check if user is logged in
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // User is not logged in, redirect to login page
            window.location.href = 'login.html';
            return;
        }
        
        // User is logged in
        currentUser = user;
        
        // Load user profile from Realtime Database
        await loadUserProfile();
        
        // Load user tasks from Realtime Database
        await loadUserTasks();
        
        // Update UI with user data
        updateUIWithUserData();
        
        // Set today's date as default for the task form
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('taskDate').value = today;
        
        // Set default time to current time + 1 hour
        const now = new Date();
        now.setHours(now.getHours() + 1);
        const timeString = now.toTimeString().substring(0, 5);
        document.getElementById('taskTime').value = timeString;
        
        // Render initial calendar
        renderCalendar(currentMonth, currentYear);
        
        // Update all displays
        updateAllDisplays();
        
        // Update profile display
        updateProfileDisplay();
        
        // Setup real-time listeners
        setupRealTimeListeners();
    });
}

// Set up real-time listeners
function setupRealTimeListeners() {
    // Tasks listener
    db.ref(`tasks/${currentUser.uid}`).on('value', (snapshot) => {
        tasks = [];
        snapshot.forEach(childSnapshot => {
            const task = childSnapshot.val();
            task.id = childSnapshot.key;
            
            if (task.completed === undefined) {
                task.completed = false;
            }
            
            tasks.push(task);
        });

        tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // NOTIFICATION DUE CHECK
        // Check for tasks due today/tomorrow only on the first load of the session
        if (!dueNotificationsChecked) {
            tasks.filter(task => !task.completed && isTaskDue(task.date)).forEach(task => {
                addNotification('due', task.name, task.date);
            });
            dueNotificationsChecked = true;
        }
        
        updateAllDisplays();
    }, (error) => {
        console.error('Error in tasks listener:', error);
    });
    
    // Profile listener
    db.ref(`users/${currentUser.uid}`).on('value', (snapshot) => {
        if (snapshot.exists()) {
            userProfile = snapshot.val();
            updateUIWithUserData();
            updateProfileDisplay();
        }
    }, (error) => {
        console.error('Error in profile listener:', error);
    });
}

// Load user profile from Realtime Database
async function loadUserProfile() {
    try {
        const snapshot = await db.ref(`users/${currentUser.uid}`).once('value');
        
        if (snapshot.exists()) {
            userProfile = snapshot.val();
        } else {
            userProfile = {
                name: currentUser.displayName || 'Student',
                email: currentUser.email,
                photoURL: '', 
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            await db.ref(`users/${currentUser.uid}`).set(userProfile);
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        userProfile = {
            name: 'Student',
            email: currentUser.email,
            photoURL: ''
        };
    }
}

// Load user tasks from Realtime Database
async function loadUserTasks() {
    try {
        const snapshot = await db.ref(`tasks/${currentUser.uid}`).once('value');
            
        tasks = [];
        snapshot.forEach(childSnapshot => {
            const task = childSnapshot.val();
            task.id = childSnapshot.key;
            
            if (task.completed === undefined) {
                task.completed = false;
            }
            
            tasks.push(task);
        });
        
        tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (tasks.length === 0) {
            await addSampleTasks();
            await loadUserTasks();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        alert('Error loading tasks. Please refresh the page.');
    }
}

// Add sample tasks for new users
async function addSampleTasks() {
    const sampleTasks = {
        task1: {
            userId: currentUser.uid,
            name: 'Read Chapter 2',
            type: 'assignment',
            date: new Date().toISOString().split('T')[0],
            time: '10:00',
            priority: 'medium',
            notes: 'Assignment',
            completed: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        },
        task2: {
            userId: currentUser.uid,
            name: 'Calculus Exam',
            type: 'exam',
            date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '10:00',
            priority: 'high',
            notes: 'Exam',
            completed: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        },
        task3: {
            userId: currentUser.uid,
            name: 'Physics Homework',
            type: 'assignment',
            date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '14:00',
            priority: 'low',
            notes: 'Complete problems 1-10',
            completed: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        }
    };
    
    try {
        await db.ref(`tasks/${currentUser.uid}`).set(sampleTasks);
    } catch (error) {
        console.error('Error adding sample tasks:', error);
    }
}

// Function to get the time of day greeting
function getGreetingTime() {
    const hour = new Date().getHours();
    if (hour < 12) {
        return "Good Morning";
    } else if (hour < 18) {
        return "Good Afternoon";
    } else {
        return "Good Evening";
    }
}

// Update UI with user data
function updateUIWithUserData() {
    const welcomeHeading = document.querySelector('.welcome-section h1');
    if (welcomeHeading && userProfile) {
        welcomeHeading.textContent = `${getGreetingTime()}, ${userProfile.name}!`;
    }
}

// Enable profile editing
function enableProfileEditing() {
    document.getElementById('profile-fullname').removeAttribute('readonly');
    document.getElementById('save-profile').style.display = 'block';
    document.getElementById('edit-profile').style.display = 'none';
}

// Save profile to Realtime Database
async function saveProfile() {
    try {
        const newName = document.getElementById('profile-fullname').value;
        const newPhotoURL = document.getElementById('profile-pic').src;

        if (!newName) {
            alert('Please enter your name');
            return;
        }

        await db.ref(`users/${currentUser.uid}`).update({
            name: newName,
            photoURL: newPhotoURL,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });

        updateUIWithUserData();
        updateProfileDisplay();
        
        document.getElementById('profile-fullname').setAttribute('readonly', true);
        document.getElementById('save-profile').style.display = 'none';
        document.getElementById('edit-profile').style.display = 'block';
        
        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error saving profile. Please try again.');
    }
}

// Upload profile photo
function uploadProfilePhoto(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-pic').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Update profile display
function updateProfileDisplay() {
    if (userProfile) {
        document.getElementById('profile-name').textContent = userProfile.name;
        document.getElementById('profile-title').textContent = 'Student';
        document.getElementById('profile-email-display').innerHTML = `<i class="fas fa-envelope"></i> ${userProfile.email}`;
        
        document.getElementById('profile-fullname').value = userProfile.name;
        document.getElementById('profile-email').value = userProfile.email;
        
        if (userProfile.photoURL) {
            document.getElementById('profile-pic').src = userProfile.photoURL;
        }
        
        document.getElementById('profile-fullname').setAttribute('readonly', true);
        document.getElementById('save-profile').style.display = 'none';
        document.getElementById('edit-profile').style.display = 'block';
    }
}

// Render calendar
function renderCalendar(month, year) {
    const calendarDays = document.getElementById('calendar-days');
    const calendarMonth = document.getElementById('calendar-month');
    
    calendarMonth.textContent = `${monthNames[month]} ${year}`;
    calendarDays.innerHTML = '';
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day-header';
        dayElement.textContent = day;
        calendarDays.appendChild(dayElement);
    });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarDays.appendChild(emptyDay);
    }
    
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayElement.classList.add('today');
        }
        
        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = i;
        dayElement.appendChild(dayNumber);
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayTasks = tasks.filter(task => task.date === dateStr && !task.completed);
        
        dayTasks.forEach(task => {
            const eventElement = document.createElement('div');
            eventElement.className = `calendar-event event-${task.type}`;
            eventElement.textContent = task.name;
            dayElement.appendChild(eventElement);
            dayElement.classList.add('has-event');
        });
        
        // Add event listener to each day for the pop-up
        dayElement.addEventListener('click', () => {
            const day = parseInt(dayElement.textContent);
            if (!isNaN(day)) {
                const selectedDate = new Date(currentYear, currentMonth, day);
                showDailyTasksModal(selectedDate);
            }
        });

        calendarDays.appendChild(dayElement);
    }
}

// Function to display daily tasks in a modal
function showDailyTasksModal(date) {
    const modal = document.getElementById('daily-tasks-modal');
    const modalTitle = document.getElementById('modal-date-title');
    const modalTaskList = document.getElementById('modal-tasks-list');
    const closeBtn = document.querySelector('.modal .close-btn');

    modalTitle.textContent = `Tasks for ${date.toDateString()}`;
    modalTaskList.innerHTML = ''; // Clear previous tasks

    const dayTasks = tasks.filter(task => {
        const taskDate = new Date(task.date);
        return taskDate.toDateString() === date.toDateString();
    });

    if (dayTasks.length === 0) {
        modalTaskList.innerHTML = '<p>No tasks scheduled for this day.</p>';
    } else {
        dayTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item'; // Use existing task-item class
            taskElement.innerHTML = `
                <div class="task-info">
                    <h4><span class="priority-indicator priority-${task.priority}"></span>${task.name}</h4>
                    <p>${task.time} - ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}</p>
                    ${task.notes ? `<p class="task-notes">Notes: ${task.notes}</p>` : ''}
                    <div class="task-date">${task.date}</div>
                </div>
                <div class="task-actions">
                    <button class="edit-task-btn" data-id="${task.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-task-btn" data-id="${task.id}"><i class="fas fa-trash-alt"></i></button>
                    <input type="checkbox" class="complete-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                </div>
            `;
            modalTaskList.appendChild(taskElement);
        });

        // Re-attach listeners for the new elements in the modal
        attachTaskActionListeners(modalTaskList);
    }

    modal.style.display = 'block';

    // Close modal event listeners
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

// Function to open edit task modal
function openEditTaskModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modal = document.getElementById('edit-task-modal');
    document.getElementById('edit-task-id').value = taskId;
    document.getElementById('editTaskName').value = task.name;
    document.getElementById('editTaskDate').value = task.date;
    document.getElementById('editTaskTime').value = task.time;
    document.getElementById('editTaskNotes').value = task.notes || '';
    
    // Set priority
    document.querySelector(`input[name="editTaskPriority"][value="${task.priority}"]`).checked = true;
    
    // Set type
    document.querySelector(`input[name="editTaskType"][value="${task.type}"]`).checked = true;
    
    modal.style.display = 'block';
    
    // Close modal event listeners
    const closeBtn = document.querySelector('.edit-close-btn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

// Function to save edited task
async function saveEditedTask(e) {
    // Prevent form submission if called from form submit event
    if (e) e.preventDefault();
    
    const taskId = document.getElementById('edit-task-id').value;
    const name = document.getElementById('editTaskName').value;
    const date = document.getElementById('editTaskDate').value;
    const time = document.getElementById('editTaskTime').value;
    const priority = document.querySelector('input[name="editTaskPriority"]:checked').value;
    const type = document.querySelector('input[name="editTaskType"]:checked').value;
    const notes = document.getElementById('editTaskNotes').value;
    
    if (!name || !date) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        await db.ref(`tasks/${currentUser.uid}/${taskId}`).update({
            name,
            date,
            time: time || '00:00',
            priority,
            type,
            notes,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Close the modal first
        document.getElementById('edit-task-modal').style.display = 'none';
        
        // Then show success message
        setTimeout(() => {
            alert('Task updated successfully!');
        }, 100);
        
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Error updating task. Please try again.');
    }
}

// Add task functionality
async function addTask() {
    const name = document.getElementById('taskName').value;
    const type = document.querySelector('input[name="taskType"]:checked').value;
    const date = document.getElementById('taskDate').value;
    const time = document.getElementById('taskTime').value;
    const priority = document.querySelector('input[name="taskPriority"]:checked').value;
    const notes = document.getElementById('taskNotes').value;
    
    if (!name || !date) {
        alert('Please fill in all required fields');
        return;
    }
    
    const newTask = {
        userId: currentUser.uid,
        name,
        type,
        date,
        time: time || '00:00',
        priority,
        notes,
        completed: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    
    try {
        await db.ref(`tasks/${currentUser.uid}`).push(newTask);
        
        // NEW NOTIFICATION CALL
        addNotification('added', name);
        // -----------------------------
        
        document.getElementById('taskName').value = '';
        document.getElementById('taskNotes').value = '';
        
        alert('Task added successfully!');
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Error adding task. Please try again.');
    }
}

// Update all displays
function updateAllDisplays() {
    updateHomePage();
    updateProgress();
    renderCalendar(currentMonth, currentYear);
}

// Function to attach listeners for task actions (complete, delete, and edit)
function attachTaskActionListeners(container) {
    // Add event listener for complete checkboxes
    container.querySelectorAll('.complete-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async function() {
            const taskId = this.getAttribute('data-id');
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                task.completed = this.checked;
                
                try {
                    await db.ref(`tasks/${currentUser.uid}/${taskId}`).update({ completed: task.completed });
                    updateAllDisplays();
                } catch (error) {
                    console.error('Error updating task:', error);
                    alert('Error updating task. Please try again.');
                    this.checked = !this.checked;
                    task.completed = this.checked;
                }
            }
        });
    });

    // Add event listener for delete buttons
    container.querySelectorAll('.delete-task-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const taskId = this.getAttribute('data-id');
            
            // Get name before deletion for notification
            const taskToDelete = tasks.find(t => t.id === taskId);
            const taskName = taskToDelete ? taskToDelete.name : 'A task';
            
            if (confirm('Are you sure you want to delete this task?')) {
                try {
                    await db.ref(`tasks/${currentUser.uid}/${taskId}`).remove();
                    
                    // Notification for deletion
                    addNotification('removed', taskName);
                    
                    updateAllDisplays();
                    // If the modal is open, close it after deletion
                    document.getElementById('daily-tasks-modal').style.display = 'none';
                } catch (error) {
                    console.error('Error deleting task:', error);
                    alert('Error deleting task. Please try again.');
                }
            }
        });
    });
    
    // Add event listener for edit buttons
    container.querySelectorAll('.edit-task-btn').forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.getAttribute('data-id');
            openEditTaskModal(taskId);
        });
    });
}

// Update home page
function updateHomePage() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // TODAY'S TASKS: Tugas yang bertarikh HARI INI dan belum selesai
    const todayTasks = tasks.filter(task => task.date === todayStr && !task.completed);
    
    // Change from 7 days to 30 days for upcoming tasks
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    
    // UPCOMING TASKS: Tugas yang bertarikh SELEPAS HARI INI dan dalam 30 hari akan datang, serta belum selesai
    const upcomingTasks = tasks.filter(task => {
        const taskDate = new Date(task.date);
        
        // Tetapkan masa today ke 00:00:00 untuk perbandingan yang tepat (hanya tarikh)
        const dateOnlyToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        // Tukar taskDate kepada objek tarikh untuk perbandingan mudah
        const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
        
        // 1. Mesti selepas hari ini (penting untuk tidak termasuk todayTasks)
        const isAfterToday = taskDateOnly.getTime() > dateOnlyToday.getTime();
        
        // 2. Mesti dalam lingkungan 30 hari dari sekarang
        const isWithinNext30Days = taskDate <= nextMonth;
        
        // 3. Mesti belum selesai
        const isNotCompleted = !task.completed;
        
        // Gabungkan semua penapisan
        return isAfterToday && isWithinNext30Days && isNotCompleted;
    });
    
    // Sort tasks by priority, date, and time
    const sortTasks = (taskList) => {
        return taskList.sort((a, b) => {
            // Priority sorting (high > medium > low)
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            // Date sorting (earlier dates first)
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            
            // Time sorting (earlier times first)
            // Handle empty times by treating them as "00:00"
            const timeA = a.time || "00:00";
            const timeB = b.time || "00:00";
            return timeA.localeCompare(timeB);
        });
    };
    
    const dueTasks = tasks.filter(task => !task.completed);
    const exams = tasks.filter(task => task.type === 'exam' && !task.completed);
    const completedTasks = tasks.filter(task => task.completed);
    
    document.getElementById('due-count').textContent = dueTasks.length;
    document.getElementById('exam-count').textContent = exams.length;
    document.getElementById('completed-count').textContent = completedTasks.length;
    
    const todayTasksContainer = document.getElementById('today-tasks');
    todayTasksContainer.innerHTML = '';
    
    if (todayTasks.length === 0) {
        todayTasksContainer.innerHTML = '<p>No tasks for today!</p>';
    } else {
        // PERHATIAN: Di sini anda menggunakan sortTasks() yang mengutamakan Priority. 
        // Jika anda ingin tugas hari ini diutamakan mengikut MASA (seperti yang biasa untuk tugas harian), anda mungkin perlu menukar peraturan di sini.
        // Buat masa ini, saya kekalkan sortTasks asal anda.
        sortTasks(todayTasks).forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item task-${task.type} ${task.completed ? 'completed' : ''}`; // Menambah task-type class
            
          taskElement.innerHTML = `
                <div class="task-info">
                    <span class="type-badge badge-${task.type}">${task.type.toUpperCase().substring(0, 3)}</span>
                    <h4 class="task-name ${task.completed ? 'strikethrough' : ''}"><span class="priority-indicator priority-${task.priority}"></span>${task.name}</h4>
                    <p>${task.time || 'All day'} - ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}</p>
                    ${task.notes ? `<p class="task-notes">Notes: ${task.notes}</p>` : ''}
                </div>
                <div class="task-actions">
                    <button class="edit-task-btn" data-id="${task.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-task-btn" data-id="${task.id}"><i class="fas fa-trash-alt"></i></button>
                    <input type="checkbox" class="complete-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                </div>
            `;
            
            todayTasksContainer.appendChild(taskElement);
        });
    }
    
    const upcomingTasksContainer = document.getElementById('upcoming-tasks');
    upcomingTasksContainer.innerHTML = '';
    
    if (upcomingTasks.length === 0) {
        upcomingTasksContainer.innerHTML = '<p>No upcoming tasks in the next 30 days!</p>';
    } else {
        sortTasks(upcomingTasks).forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item task-${task.type} ${task.completed ? 'completed' : ''}`; // Menambah task-type class
            
            const taskDate = new Date(task.date);
            const formattedDate = taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
           taskElement.innerHTML = `
                <div class="task-info">
                    <span class="type-badge badge-${task.type}">${task.type.toUpperCase().substring(0, 3)}</span>
                    <h4 class="task-name"><span class="priority-indicator priority-${task.priority}"></span>${task.name}</h4>
                    <p>${task.time || 'All day'} - ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}</p>
                    ${task.notes ? `<p class="task-notes">Notes: ${task.notes}</p>` : ''}
                    <div class="task-date">${formattedDate}</div>
                </div>
                <div class="task-actions">
                    <button class="edit-task-btn" data-id="${task.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-task-btn" data-id="${task.id}"><i class="fas fa-trash-alt"></i></button>
                    <input type="checkbox" class="complete-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                </div>
            `;
            
            upcomingTasksContainer.appendChild(taskElement);
        });
    }
    
    // Pastikan `attachTaskActionListeners` dipanggil pada keseluruhan kontena home page
    attachTaskActionListeners(document.getElementById('home'));
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    });
}

// BACKGROUND MUSIC LOGIC
// Select the audio element and the new toggle button/icon
const audio = document.getElementById('bg-music');
const musicToggle = document.getElementById('music-toggle');
const musicIcon = musicToggle ? musicToggle.querySelector('i') : null; // Get the actual <i> tag

// Get the flag set on login/register to know if music should start
const musicFlag = localStorage.getItem('musicStarted');
// Check if the user had explicitly paused the music on a previous visit
const isMusicPaused = localStorage.getItem('isMusicPaused') === 'true';

// Set a comfortable volume (0.5 is 50%)
if (audio) {
    audio.volume = 0.5;
}

// Function to update the icon's visual state (blue for playing, gray for paused)
function updateMusicIconState() {
    if (musicIcon) {
        if (audio.paused) {
            musicToggle.classList.remove('playing'); // Remove blue state
        } else {
            musicToggle.classList.add('playing');    // Add blue state
        }
    }
}

// Function to handle playing the audio
function playBackgroundMusic() {
    if (audio) {
        audio.play().then(() => {
            console.log('Background music started.');
            localStorage.setItem('isMusicPaused', 'false');
            updateMusicIconState(); // Update icon to blue
        }).catch(error => {
            console.warn('Autoplay prevented. Click the music icon to start.', error);
            // If autoplay fails, ensure the icon is in the paused (gray) state
            localStorage.setItem('isMusicPaused', 'true'); // Treat as paused if it couldn't play
            updateMusicIconState(); // Update icon to gray
        });
    }
}

// Function to handle pausing the audio
function pauseBackgroundMusic() {
    if (audio) {
        audio.pause();
        localStorage.setItem('isMusicPaused', 'true');
        updateMusicIconState(); // Update icon to gray
    }
}

// Initial State Setup & Autoplay Attempt
if (audio && musicToggle) {
    if (isMusicPaused) {
        // Music was manually paused, keep it paused and show the gray icon
        pauseBackgroundMusic();
    } else {
        // If music was not paused AND the login flag is set, attempt to play.
        if (musicFlag === 'true') {
             playBackgroundMusic();
        } else {
            // Default state if no flag and not previously paused: gray icon
            updateMusicIconState(); // Ensure icon reflects current (likely paused) state
        }
    }
}


// Music Toggle Event Listener
if (musicToggle && audio) {
    musicToggle.addEventListener('click', () => {
        if (audio.paused) {
            playBackgroundMusic();
        } else {
            pauseBackgroundMusic();
        }
    });
}

// Clear the flag after checking it (important for next page load)

localStorage.removeItem('musicStarted'); 
