
const AuthService = (() => {
    const USERS_KEY = "auth.users" // object keyed by username
    const CURRENT_KEY = "auth.currentUser" // string username

    function _loadUsers() {
        try {
            const raw = localStorage.getItem(USERS_KEY)
            return raw ? JSON.parse(raw) : {}
        } catch {
            return {}
        }
    }

    function _saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users))
    }

    function _normalizeDOB(dob) {
        // Accepts "YYYY-MM-DD" (from <input type="date">) and ensures consistent string
        if (!dob) return ""
        // Simple normalization; assume browser gives yyyy-mm-dd
        return String(dob).trim()
    }

    function _nowISO() {
        return new Date().toISOString()
    }

    function register({ username, email, password, dob }) {
        const users = _loadUsers()
        const uname = String(username || "")
            .trim()
            .toLowerCase()
        const mail = String(email || "")
            .trim()
            .toLowerCase()
        const birth = _normalizeDOB(dob)

        if (!uname || !mail || !password || !birth) {
            return { ok: false, error: "All fields are required." }
        }
        if (password.length < 6) {
            return { ok: false, error: "Password must be at least 6 characters." }
        }
        if (users[uname]) {
            return { ok: false, error: "Username is already taken." }
        }
        // Ensure unique email
        const emailTaken = Object.values(users).some((u) => (u.email || "").toLowerCase() === mail)
        if (emailTaken) {
            return { ok: false, error: "An account with this email already exists." }
        }

        const createdAt = _nowISO()
        users[uname] = {
            username: uname,
            email: mail,
            password, // demo only
            dob: birth,
            createdAt,
            signInCount: 1,
            lastLoginAt: createdAt,
            lastPasswordResetAt: null,
        }
        _saveUsers(users)
        // Auto-login on signup
        localStorage.setItem(CURRENT_KEY, uname)
        return { ok: true, user: { ...users[uname], password: undefined } }
    }

    function login({ username, password }) {
        const users = _loadUsers()
        const uname = String(username || "")
            .trim()
            .toLowerCase()

        if (!uname || !password) {
            return { ok: false, error: "Please enter your username and password." }
        }
        const user = users[uname]
        if (!user || user.password !== password) {
            return { ok: false, error: "Invalid username or password." }
        }

        user.signInCount = (user.signInCount || 0) + 1
        user.lastLoginAt = _nowISO()
        _saveUsers(users)

        localStorage.setItem(CURRENT_KEY, uname)
        return { ok: true, user: { ...user, password: undefined } }
    }

    function resetPassword({ username, dob, newPassword }) {
        const users = _loadUsers()
        const uname = String(username || "")
            .trim()
            .toLowerCase()
        const birth = _normalizeDOB(dob)

        if (!uname || !birth || !newPassword) {
            return { ok: false, error: "All fields are required." }
        }
        if (newPassword.length < 6) {
            return { ok: false, error: "Password must be at least 6 characters." }
        }
        const user = users[uname]
        if (!user) {
            return { ok: false, error: "No user found with that username." }
        }
        if (_normalizeDOB(user.dob) !== birth) {
            return { ok: false, error: "Date of birth does not match our records." }
        }
        user.password = newPassword
        user.lastPasswordResetAt = _nowISO()
        _saveUsers(users)
        return { ok: true }
    }

    function getCurrentUser() {
        const uname = localStorage.getItem(CURRENT_KEY)
        if (!uname) return null
        const users = _loadUsers()
        const user = users[uname]
        if (!user) return null
        const { password, ...safe } = user
        return safe
    }

    function logout() {
        localStorage.removeItem(CURRENT_KEY)
    }

    // Guards
    function requireAuthOrRedirect() {
        const user = getCurrentUser()
        if (!user) {
            navigateWithFade("index.html")
        }
        return !!user
    }

    function redirectIfAuthenticated() {
        const user = getCurrentUser()
        if (user) {
            navigateWithFade("dashboard.html")
            return true
        }
        return false
    }

    return {
        register,
        login,
        resetPassword,
        getCurrentUser,
        logout,
        requireAuthOrRedirect,
        redirectIfAuthenticated,
    }
})()

// -----------------------------
// PostService and helpers for a local social feed (demo only)
// -----------------------------
const PostService = (() => {
    const POSTS_KEY = "auth.posts"
    const SEEDED_KEY = "auth.postsSeeded"

    function _load() {
        try {
            return JSON.parse(localStorage.getItem(POSTS_KEY) || "[]")
        } catch {
            return []
        }
    }
    function _save(list) {
        localStorage.setItem(POSTS_KEY, JSON.stringify(list))
    }
    function seed() {
        if (localStorage.getItem(SEEDED_KEY)) return
        const now = Date.now()
        const demo = [
            {
                id: crypto.randomUUID?.() || String(now + 1),
                author: "alex",
                text: "Just started using this app. Loving the clean UI!",
                createdAt: new Date(now - 1000 * 60 * 60).toISOString(),
                likes: ["maria"],
                comments: [
                    { id: "c1", author: "maria", text: "Welcome! 🎉", createdAt: new Date(now - 1000 * 60 * 45).toISOString() },
                ],
            },
            {
                id: crypto.randomUUID?.() || String(now + 2),
                author: "maria",
                text: "Dark mode all the way. What features should we add next?",
                createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
                likes: [],
                comments: [],
            },
        ]
        _save(demo)
        localStorage.setItem(SEEDED_KEY, "1")
    }
    function list() {
        return _load().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    function add({ author, text }) {
        const post = {
            id: crypto.randomUUID?.() || String(Date.now()),
            author,
            text: String(text || "").trim(),
            createdAt: new Date().toISOString(),
            likes: [],
            comments: [],
        }
        if (!post.text) return { ok: false, error: "Post cannot be empty." }
        const list = _load()
        list.push(post)
        _save(list)
        return { ok: true, post }
    }
    function toggleLike(id, username) {
        const list = _load()
        const p = list.find((x) => x.id === id)
        if (!p) return { ok: false, error: "Post not found." }
        p.likes = Array.isArray(p.likes) ? p.likes : []
        const i = p.likes.indexOf(username)
        if (i >= 0) p.likes.splice(i, 1)
        else p.likes.push(username)
        _save(list)
        return { ok: true, likes: p.likes.length }
    }

    function deletePost(id) {
        const list = _load()
        const p = list.find((x) => x.id === id)
        if (!p) return { ok: false, error: "Post not found." }
        const next = list.filter((x) => x.id !== id)
        _save(next)
        return { ok: true }
    }

    function addComment(id, { author, text }) {
        const t = String(text || "").trim()
        if (!t) return { ok: false, error: "Comment cannot be empty." }
        const list = _load()
        const p = list.find((x) => x.id === id)
        if (!p) return { ok: false, error: "Post not found." }
        p.comments = Array.isArray(p.comments) ? p.comments : []
        p.comments.push({
            id: crypto.randomUUID?.() || String(Date.now()),
            author,
            text: t,
            createdAt: new Date().toISOString(),
        })
        _save(list)
        return { ok: true, count: p.comments.length }
    }
    function suggestions() {
        return [
            { name: "Alex Johnson", handle: "@alex" },
            { name: "Maria Gomez", handle: "@maria" },
            { name: "Sam Lee", handle: "@sam" },
        ]
    }
    return { seed, list, add, toggleLike, deletePost, addComment, suggestions }
})()

// -----------------------------
// FollowService to toggle follow buttons in sidebar
// -----------------------------
const FollowService = (() => {
    const KEY = "auth.following"
    const _load = () => {
        try {
            return JSON.parse(localStorage.getItem(KEY) || "[]")
        } catch {
            return []
        }
    }
    const _save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr))
    function isFollowing(handle) {
        return _load().includes(handle)
    }
    function toggle(handle) {
        const set = _load()
        const i = set.indexOf(handle)
        if (i >= 0) set.splice(i, 1)
        else set.push(handle)
        _save(set)
        return set.includes(handle)
    }
    return { isFollowing, toggle }
})()

// -----------------------------
// UI Helpers
// -----------------------------
function el(id) {
    return document.getElementById(id)
}

function showMessage(containerId, type, text) {
    const container = el(containerId)
    if (!container) return
    container.classList.remove("visually-hidden")
    container.className = "" // reset
    container.id = containerId
    container.classList.add("alert", type === "error" ? "alert-danger" : "alert-success")
    container.textContent = text
}

function clearMessage(containerId) {
    const container = el(containerId)
    if (!container) return
    container.classList.add("visually-hidden")
    container.textContent = ""
}

function navigateWithFade(url) {
    const root = document.documentElement
    const go = () => {
        window.location.href = url
    }

    // Respect reduced motion
    const prefersReduced =
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
        go()
        return
    }

    let navigated = false
    const done = () => {
        if (navigated) return
        navigated = true
        go()
    }

    // Apply fade-out class and attempt to listen for animation end
    root.classList.add("fade-out")

    // If no animation is applied, fall back quickly
    const style = window.getComputedStyle(root)
    const animName = (style.animationName || style.getPropertyValue("animation-name") || "").toString()

    if (!animName || animName === "none") {
        // No animation active; navigate immediately on next tick
        setTimeout(done, 10)
        return
    }

    // Safety timeout in case animationend never fires
    const safety = setTimeout(done, 600)
    root.addEventListener(
        "animationend",
        () => {
            clearTimeout(safety)
            done()
        },
        { once: true },
    )
}

// Enhance links that opt-in to transitions
function setupLinkTransitions() {
    document.querySelectorAll("a[data-transition]").forEach((a) => {
        a.addEventListener("click", (e) => {
            const url = a.getAttribute("href")
            if (!url || url.startsWith("#") || url.startsWith("javascript:")) return
            e.preventDefault()
            navigateWithFade(url)
        })
    })
}

// -----------------------------
// Page Initializers
// -----------------------------
function initLoginPage() {
    if (AuthService.redirectIfAuthenticated()) return

    const form = el("login-form")
    form?.addEventListener("submit", (e) => {
        e.preventDefault()
        clearMessage("login-message")

        const data = new FormData(form)
        const username = data.get("username")
        const password = data.get("password")

        const res = AuthService.login({ username, password })
        if (!res.ok) {
            showMessage("login-message", "error", res.error)
            return
        }
        navigateWithFade("dashboard.html")
    })
}

function initSignupPage() {
    if (AuthService.redirectIfAuthenticated()) return

    const form = el("signup-form")
    form?.addEventListener("submit", (e) => {
        e.preventDefault()
        clearMessage("signup-message")

        const data = new FormData(form)
        const username = data.get("username")
        const email = data.get("email")
        const dob = data.get("dob")
        const password = data.get("password")
        const confirm = data.get("confirm")

        if (String(password) !== String(confirm)) {
            showMessage("signup-message", "error", "Passwords do not match.")
            return
        }

        const res = AuthService.register({ username, email, dob, password })
        if (!res.ok) {
            showMessage("signup-message", "error", res.error)
            return
        }

        navigateWithFade("dashboard.html")
    })
}

function initForgotPage() {
    const form = el("forgot-form")
    form?.addEventListener("submit", (e) => {
        e.preventDefault()
        clearMessage("forgot-message")

        const data = new FormData(form)
        const username = data.get("username")
        const dob = data.get("dob")
        const password = data.get("password")
        const confirm = data.get("confirm")

        if (String(password) !== String(confirm)) {
            showMessage("forgot-message", "error", "Passwords do not match.")
            return
        }

        const res = AuthService.resetPassword({ username, dob, newPassword: password })
        if (!res.ok) {
            showMessage("forgot-message", "error", res.error)
            return
        }
        showMessage("forgot-message", "success", "Password updated. Redirecting to sign in...")
        setTimeout(() => navigateWithFade("index.html"), 800)
    })
}

function formatDateTime(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (isNaN(d)) return "—"
    return d.toLocaleString()
}

function initDashboardPage() {
    if (!AuthService.requireAuthOrRedirect()) return

    const user = AuthService.getCurrentUser()
    if (user) {
        el("profile-username").textContent = user.username
        el("profile-email").textContent = user.email
        el("profile-dob").textContent = user.dob
        const created = new Date(user.createdAt)
        el("profile-created").textContent = isNaN(created) ? "—" : created.toLocaleDateString()

        const memberSince = isNaN(created) ? "—" : created.toLocaleDateString()
        const signins = typeof user.signInCount === "number" ? user.signInCount : 1
        const lastLogin = formatDateTime(user.lastLoginAt)

        const statMember = el("stat-member-since")
        const statSignins = el("stat-signins")
        const statLastLogin = el("stat-last-login")

        if (statMember) statMember.textContent = memberSince
        if (statSignins) statSignins.textContent = String(signins)
        if (statLastLogin) statLastLogin.textContent = lastLogin

        const activities = [
            { label: "Account created", date: user.createdAt, tag: "Account" },
            { label: "Last login", date: user.lastLoginAt, tag: "Login" },
        ]
        if (user.lastPasswordResetAt) {
            activities.push({ label: "Password reset", date: user.lastPasswordResetAt, tag: "Security" })
        }

        // Sort newest first
        activities.sort((a, b) => new Date(b.date) - new Date(a.date))

        const list = el("activity-list")
        if (list) {
            list.innerHTML = ""
            activities.forEach((a) => {
                const li = document.createElement("li")
                const left = document.createElement("div")
                const right = document.createElement("span")
                right.className = "badge"
                right.textContent = a.tag

                const title = document.createElement("div")
                title.textContent = a.label
                const sub = document.createElement("div")
                sub.className = "muted"
                sub.textContent = formatDateTime(a.date)

                left.appendChild(title)
                left.appendChild(sub)

                li.appendChild(left)
                li.appendChild(right)

                list.appendChild(li)
            })
        }
    }

    el("action-update-email")?.addEventListener("click", () => {
        showMessage("dashboard-message", "success", "Email update coming soon. Hook this to your backend later.")
    })

    el("logout-btn")?.addEventListener("click", () => {
        AuthService.logout()
        navigateWithFade("index.html")
    })

    PostService.seed()

    const composer = el("composer-form")
    const textarea = el("composer-text")
    const counter = el("composer-count")
    const feed = el("feed-list")
    const suggestionsList = document.getElementById("suggestions-list")

    function renderFeed() {
        if (!feed) return
        const posts = PostService.list()
        feed.innerHTML = ""
        posts.forEach((p) => {
            const li = document.createElement("li")
            li.className = "post"
            li.dataset.id = p.id

            const avatar = document.createElement("div")
            avatar.className = "avatar"
            avatar.textContent = (p.author || "?").charAt(0).toUpperCase()

            const content = document.createElement("div")

            const header = document.createElement("div")
            header.className = "post-header"
            const author = document.createElement("span")
            author.className = "post-author"
            author.textContent = p.author
            const meta = document.createElement("span")
            meta.className = "post-meta"
            meta.textContent = formatDateTime(p.createdAt)
            header.appendChild(author)
            header.appendChild(meta)

            const body = document.createElement("div")
            body.className = "post-body"
            body.textContent = p.text

            const actions = document.createElement("div")
            actions.className = "post-actions"
            const you = user?.username || "you"
            const liked = (p.likes || []).includes(you)

            const likeBtn = document.createElement("button")
            likeBtn.className = "btn btn-ghost btn-xs" + (liked ? " is-liked" : "")
            likeBtn.dataset.action = "like"
            likeBtn.dataset.id = p.id
            likeBtn.setAttribute("aria-pressed", liked ? "true" : "false")
            likeBtn.innerHTML = `<span class="label">Like</span><span class="count">${(p.likes || []).length}</span>`

            const commentBtn = document.createElement("button")
            commentBtn.className = "btn btn-ghost btn-xs"
            commentBtn.dataset.action = "toggle-comments"
            commentBtn.dataset.id = p.id
            commentBtn.innerHTML = `<span class="label">Comment</span><span class="count">${(p.comments || []).length}</span>`

            actions.appendChild(likeBtn)
            actions.appendChild(commentBtn)

            const delBtn = document.createElement("button")
            delBtn.className = "btn btn-ghost btn-xs btn-danger"
            delBtn.dataset.action = "delete"
            delBtn.dataset.id = p.id
            delBtn.textContent = "Delete"
            actions.appendChild(delBtn)

            // comments box (collapsed by default)
            const box = document.createElement("div")
            box.className = "comment-box hidden"
            box.id = `comments-${p.id}`

            const commentsList = document.createElement("ul")
            commentsList.className = "list comments"
                ; (p.comments || []).forEach((c) => {
                    const ci = document.createElement("li")
                    ci.className = "comment-item"
                    ci.innerHTML = `<div class="avatar small">${(c.author || "?").charAt(0).toUpperCase()}</div>
                        <div class="comment-content">
                          <div class="comment-head"><strong>${c.author}</strong> <span class="muted">${formatDateTime(
                        c.createdAt,
                    )}</span></div>
                          <div class="comment-text">${c.text}</div>
                        </div>`
                    commentsList.appendChild(ci)
                })

            const form = document.createElement("form")
            form.className = "comment-form"
            form.dataset.id = p.id
            form.innerHTML = `
        <label class="visually-hidden" for="comment-${p.id}">Add a comment</label>
        <input id="comment-${p.id}" name="comment" class="comment-input" placeholder="Write a comment..." />
        <button class="btn btn-primary btn-sm" type="submit">Reply</button>
      `

            box.appendChild(commentsList)
            box.appendChild(form)

            content.appendChild(header)
            content.appendChild(body)
            content.appendChild(actions)
            content.appendChild(box)

            li.appendChild(avatar)
            li.appendChild(content)
            feed.appendChild(li)
        })
    }

    function renderSuggestions() {
        if (!suggestionsList) return
        suggestionsList.innerHTML = ""
        PostService.suggestions().forEach((s) => {
            const li = document.createElement("li")
            li.className = "suggestion"
            const left = document.createElement("div")
            left.style.display = "flex"
            left.style.alignItems = "center"
            left.style.gap = "10px"

            const av = document.createElement("div")
            av.className = "avatar"
            av.textContent = s.name.charAt(0).toUpperCase()

            const info = document.createElement("div")
            info.className = "info"
            const name = document.createElement("span")
            name.className = "name"
            name.textContent = s.name
            const handle = document.createElement("span")
            handle.className = "handle"
            handle.textContent = s.handle

            info.appendChild(name)
            info.appendChild(handle)
            left.appendChild(av)
            left.appendChild(info)

            const follow = document.createElement("button")
            const following = FollowService.isFollowing(s.handle)
            follow.className = "btn btn-ghost" + (following ? " is-active" : "")
            follow.type = "button"
            follow.dataset.handle = s.handle
            follow.textContent = following ? "Following" : "Follow"

            li.appendChild(left)
            li.appendChild(follow)
            suggestionsList.appendChild(li)
        })
    }

    textarea?.addEventListener("input", () => {
        counter && (counter.textContent = `${textarea.value.length}/300`)
    })

    composer?.addEventListener("submit", (e) => {
        e.preventDefault()
        const text = (textarea?.value || "").trim()
        if (!text) {
            showMessage("dashboard-message", "error", "Post cannot be empty.")
            return
        }
        const author = user?.username || "you"
        const res = PostService.add({ author, text })
        if (!res.ok) {
            showMessage("dashboard-message", "error", res.error)
            return
        }
        textarea.value = ""
        counter && (counter.textContent = "0/300")
        clearMessage("dashboard-message")
        renderFeed()
    })

    feed?.addEventListener("click", (e) => {
        const btn = e.target.closest?.("[data-action]")
        if (!btn) return
        const action = btn.dataset.action
        const id = btn.dataset.id
        const me = user?.username || "you"

        if (action === "like") {
            const res = PostService.toggleLike(id, me)
            if (!res.ok) {
                showMessage("dashboard-message", "error", res.error)
                return
            }
            // Update inline without full re-render
            btn.querySelector(".count").textContent = String(res.likes)
            const pressed = btn.getAttribute("aria-pressed") === "true"
            btn.setAttribute("aria-pressed", pressed ? "false" : "true")
            btn.classList.toggle("is-liked")
        }

        if (action === "delete") {
            const okToDelete = confirm("Delete this post?")
            if (!okToDelete) return
            const res = PostService.deletePost(id)
            if (!res.ok) {
                showMessage("dashboard-message", "error", res.error)
                return
            }
            const li = feed.querySelector(`li.post[data-id="${id}"]`)
            if (li) {
                li.style.opacity = "0"
                setTimeout(() => li.remove(), 180)
            }
        }

        if (action === "toggle-comments") {
            const box = document.getElementById(`comments-${id}`)
            if (box) box.classList.toggle("hidden")
        }
    })

    feed?.addEventListener("submit", (e) => {
        const form = e.target.closest?.(".comment-form")
        if (!form) return
        e.preventDefault()
        const id = form.dataset.id
        const input = form.querySelector('input[name="comment"]')
        const text = (input?.value || "").trim()
        if (!text) return
        const me = user?.username || "you"
        const res = PostService.addComment(id, { author: me, text })
        if (!res.ok) {
            showMessage("dashboard-message", "error", res.error)
            return
        }
        input.value = ""
        // Re-render that post's comment box (simpler)
        renderFeed()
    })

    suggestionsList?.addEventListener("click", (e) => {
        const btn = e.target.closest?.("button[data-handle]")
        if (!btn) return
        const handle = btn.dataset.handle
        const following = FollowService.toggle(handle)
        btn.classList.toggle("is-active", following)
        btn.textContent = following ? "Following" : "Follow"
    })

    renderFeed()
    renderSuggestions()
}

// -----------------------------
// Boot
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
    setupLinkTransitions()

    const page = document.body.getAttribute("data-page")
    switch (page) {
        case "login":
            initLoginPage()
            break
        case "signup":
            initSignupPage()
            break
        case "forgot":
            initForgotPage()
            break
        case "dashboard":
            initDashboardPage()
            break
    }
})
