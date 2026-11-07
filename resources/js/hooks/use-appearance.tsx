/**
 * The app uses a single light theme. This clears any dark mode a browser saved
 * from earlier versions of the app.
 */
export function initializeTheme() {
    document.documentElement.classList.remove('dark');

    try {
        localStorage.removeItem('appearance');
    } catch {
        // storage may be unavailable (private mode); nothing to clean up
    }
}
