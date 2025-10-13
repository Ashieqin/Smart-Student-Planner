
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
        
// Make the logged-in user info available to chatbot
window.loggedInUser = {
    name: user.displayName || "Smart Planner User",
    email: user.email || "unknown@example.com"
};
 
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
    today.setHours(0, 0, 0, 0); 
    
    // TODAY TASKS 
    const todayTasks = tasks.filter(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0); 
        return taskDate.getTime() === today.getTime() && !task.completed;
    });
    
    // Change from 7 days to 30 days for upcoming tasks
    const next30Days = new Date(today); 
    next30Days.setDate(today.getDate() + 30); 

    const upcomingTasks = tasks.filter(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0); 
        
        
        return taskDate.getTime() > today.getTime() && taskDate.getTime() <= next30Days.getTime() && !task.completed;
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
        sortTasks(todayTasks).forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
            
          taskElement.innerHTML = `
                <div class="task-info">
                    <h4><span class="priority-indicator priority-${task.priority}"></span>${task.name}</h4>
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
            taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
            
            const taskDate = new Date(task.date);
            const formattedDate = taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
           taskElement.innerHTML = `
                <div class="task-info">
                    <h4><span class="priority-indicator priority-${task.priority}"></span>${task.name}</h4>
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
    
    attachTaskActionListeners(document.getElementById('home'));
}

// Update progress page
function updateProgress() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.completed).length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    document.getElementById('progress-percent').textContent = `${progressPercent}%`;
    
    const circle = document.querySelector('.circle');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference - (progressPercent / 100) * circumference;
    
    const progressTasksContainer = document.getElementById('progress-tasks');
    progressTasksContainer.innerHTML = '';
    
    if (tasks.length === 0) {
        progressTasksContainer.innerHTML = '<p>No tasks yet!</p>';
    } else {
        // Use the same sorting function for progress page
        const sortTasks = (taskList) => {
            return taskList.sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff !== 0) return dateDiff;
                
                const timeA = a.time || "00:00";
                const timeB = b.time || "00:00";
                return timeA.localeCompare(timeB);
            });
        };
        
        sortTasks(tasks).forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.completed ? 'completed' : ''}`;
            
            const taskDate = new Date(task.date);
            const formattedDate = taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
           taskElement.innerHTML = `
                <div class="task-info">
                    <h4><span class="priority-indicator priority-${task.priority}"></span>${task.name}</h4>
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
            
            progressTasksContainer.appendChild(taskElement);
        });
        
        attachTaskActionListeners(document.getElementById('progress'));
    }
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


// BACKGROUND MUSIC LOGIC - WITH DROPDOWN SELECTOR
const audioTracks = [
    document.getElementById('bg-music'),      // lofihiphop (track 0)
    document.getElementById('bg-music-jazz'), // relaxjazz (track 1)  
    document.getElementById('bg-music-focus') // alphawaves (track 2)
];

const trackNames = ["Lofi", "Jazz", "Alpha"];
let currentTrackIndex = 0;
let isMusicPaused = localStorage.getItem('isMusicPaused') === 'true';

// DOM Elements
const musicToggle = document.getElementById('music-toggle');
const musicDropdown = document.getElementById('music-dropdown');
const currentTrackSpan = document.getElementById('current-track');
const musicOptions = document.querySelectorAll('.music-option');

// Set volume
audioTracks.forEach(audio => {
    if (audio) audio.volume = 0.5;
});

// Function to update UI
function updateMusicUI() {
    const currentAudio = audioTracks[currentTrackIndex];
    
    // Update current track display
    if (currentTrackSpan) {
        currentTrackSpan.textContent = trackNames[currentTrackIndex];
    }
    
    // Update music options highlighting
    musicOptions.forEach((option, index) => {
        option.classList.remove('active', 'playing');
        if (index === currentTrackIndex) {
            option.classList.add('active');
            if (!currentAudio.paused) {
                option.classList.add('playing');
            }
        }
    });
    
    // Update toggle button state
    if (musicToggle) {
        if (currentAudio.paused) {
            musicToggle.classList.remove('playing');
        } else {
            musicToggle.classList.add('playing');
        }
    }
}

// Function to switch to specific track
function switchToTrack(trackIndex) {
    // Validate track index
    if (trackIndex < 0 || trackIndex >= audioTracks.length || !audioTracks[trackIndex]) {
        return;
    }
    
    // Pause current track
    const currentAudio = audioTracks[currentTrackIndex];
    if (currentAudio) currentAudio.pause();
    
    // Switch to new track
    currentTrackIndex = trackIndex;
    const newAudio = audioTracks[currentTrackIndex];
    
    // Play new track if music was playing
    if (newAudio && !isMusicPaused) {
        newAudio.play().catch(error => {
            console.warn('Autoplay prevented for track switch');
        });
    }
    
    updateMusicUI();
}

// Play background music
function playBackgroundMusic() {
    const currentAudio = audioTracks[currentTrackIndex];
    if (currentAudio) {
        currentAudio.play().then(() => {
            localStorage.setItem('isMusicPaused', 'false');
            isMusicPaused = false;
            updateMusicUI();
        }).catch(error => {
            console.warn('Autoplay prevented');
        });
    }
}

// Pause background music
function pauseBackgroundMusic() {
    const currentAudio = audioTracks[currentTrackIndex];
    if (currentAudio) {
        currentAudio.pause();
        localStorage.setItem('isMusicPaused', 'true');
        isMusicPaused = true;
        updateMusicUI();
    }
}

// Music Selector - UPDATED BEHAVIOR
// Click: Show dropdown | Double Click: Play/Pause
if (musicToggle) {
    let clickTimer = null;
    
    // Single click - show dropdown
    musicToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        
        if (clickTimer === null) {
            clickTimer = setTimeout(() => {
                // Single click - toggle dropdown
                const isVisible = musicDropdown.classList.toggle('visible');
                musicToggle.setAttribute('aria-expanded', isVisible);
                clickTimer = null;
            }, 200);
        }
    });
    
    // Double click - play/pause current track
    musicToggle.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        clearTimeout(clickTimer);
        clickTimer = null;
        
        // Play/Pause current track
        const currentAudio = audioTracks[currentTrackIndex];
        if (currentAudio.paused) {
            playBackgroundMusic();
        } else {
            pauseBackgroundMusic();
        }
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (musicDropdown && musicToggle && !musicToggle.contains(event.target) && !musicDropdown.contains(event.target)) {
        musicDropdown.classList.remove('visible');
        musicToggle.setAttribute('aria-expanded', 'false');
    }
});
// Music option clicks
musicOptions.forEach(option => {
    option.addEventListener('click', function() {
        const trackIndex = parseInt(this.getAttribute('data-track'));
        switchToTrack(trackIndex);
        musicDropdown.classList.remove('visible');
    });
});

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (!musicToggle.contains(event.target) && !musicDropdown.contains(event.target)) {
        musicDropdown.classList.remove('visible');
        musicToggle.setAttribute('aria-expanded', 'false');
    }
});

// Initial setup
const musicFlag = localStorage.getItem('musicStarted');
if (musicToggle) {
    if (isMusicPaused) {
        pauseBackgroundMusic();
    } else {
        if (musicFlag === 'true') {
            playBackgroundMusic();
        }
    }
    updateMusicUI();
}

// Clear flag





document.addEventListener("DOMContentLoaded", () => {
    // === INIT EMAILJS ===
    emailjs.init("aujD6oecUSj7WdzCE");

    const bubble = document.getElementById("chatbot-bubble");
    const chatbot = document.getElementById("chatbot");
    const closeBtn = document.getElementById("chatbot-close");
    const messages = document.getElementById("chatbot-messages");
    const optionsDiv = document.getElementById("chatbot-options");
    const input = document.getElementById("chatbot-input");
    const sendBtn = document.getElementById("chatbot-send");

    let chatMode = "normal"; // "normal" | "email"

    // === FAQ DATABASE ===
    const faq = {
        "How to edit task?": "Go to your task list, click the task, select 'Edit' icon, make your changes, then click 'Save'.",
        "How to add task?": "Go to 'Add Task', fill in the details, and click 'Save' to add it to your planner.",
        "How to delete task?": "Click the task, select 'Delete' icon, and confirm to remove it.",
        "How does priority task level work?": "Priority levels (Low, Medium, High) determine importance. High-priority tasks are highlighted.",
        "Any problem? Contact this team": "contact"
    };

    // === APPEND CHAT MESSAGE ===
    function appendMsg(text, sender) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-msg " + (sender === "user" ? "user-msg" : "bot-msg");
        msgDiv.textContent = text;
        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight;
    }

    // === SHOW FAQ OPTIONS ===
    function showOptions() {
        optionsDiv.innerHTML = "";
        for (let key in faq) {
            const btn = document.createElement("button");
            btn.textContent = key;
            btn.className = "faq-btn";
            optionsDiv.appendChild(btn);

            btn.addEventListener("click", () => {
                appendMsg(key, "user");

                if (faq[key] === "contact") {
                    chatMode = "email";
                    setTimeout(() => {
                        appendMsg("You can now type your problem below. When done, click 'Send' to contact the team 💬", "bot");
                    }, 500);
                } else {
                    setTimeout(() => appendMsg(faq[key], "bot"), 600);
                }
            });
        }
    }

    // === OPEN CHATBOT ===
    bubble.addEventListener("click", () => {
        chatbot.style.display = "flex";
        chatbot.classList.add("show");

        if (messages.innerHTML === "") {
            appendMsg("Hi there! 👋 I'm your Smart Planner Assistant.", "bot");
            setTimeout(() => appendMsg("Here are some frequent questions:", "bot"), 600);
            setTimeout(showOptions, 1200);
        }
    });

    // === CLOSE CHATBOT ===
    closeBtn.addEventListener("click", () => {
        chatbot.style.display = "none";
    });

    // === SEND MESSAGE ===
    sendBtn.addEventListener("click", async () => {
        const msg = input.value.trim();
        if (!msg) return;
        appendMsg(msg, "user");
        input.value = "";

        // --- Get logged-in user info from Firebase login ---
        const userName = window.loggedInUser?.name || "Smart Planner User";
        const userEmail = window.loggedInUser?.email || "unknown@example.com";
        const timeSent = new Date().toLocaleString();

        // --- EMAIL MODE ---
        if (chatMode === "email") {
            emailjs.send("service_suadumm", "template_oceso7e", {
                name: userName,
                email: userEmail,
                time: timeSent,
                message: msg,
                to_email: "zulira04@gmail.com"
            }).then(() => {
                appendMsg("✅ Your message has been sent to the Smart Planner Team. We’ll get back to you soon!", "bot");
            }).catch((error) => {
                console.error("EmailJS Error:", error);
                appendMsg("⚠️ Failed to send message. Please try again later.", "bot");
            });
            return;
        }

        // --- NORMAL MODE: Check FAQ ---
        const found = Object.keys(faq).find(k => msg.toLowerCase().includes(k.toLowerCase()));
        if (found && faq[found] !== "contact") {
            appendMsg(faq[found], "bot");
            return;
        }

        // --- DEFAULT REPLY ---
        appendMsg("Sorry, I can only answer based on the FAQ or send messages to our team right now 💬", "bot");
    });

    // === PRESS ENTER TO SEND ===
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    // === ENABLE INPUT INITIALLY ===
    input.disabled = false;
    sendBtn.disabled = false;
});
