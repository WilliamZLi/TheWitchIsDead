Hooks.on("ready", () => {
    // Set up an observer to detect when the pause screen appears
    const observer = new MutationObserver((mutations) => {
        const pauseScreen = document.getElementById("pause");
        if (pauseScreen) {
            const img = pauseScreen.querySelector("img");
            if (img && !img.classList.contains('customized')) {
                img.src = "systems/TWID/art/logo.png";
                img.classList.add('customized'); // Mark as modified

                // Optional: change the text
                const caption = pauseScreen.querySelector("figcaption");
                if (caption) caption.textContent = "Game Paused";
            }
        }
    });

    // Observe changes on the body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});
