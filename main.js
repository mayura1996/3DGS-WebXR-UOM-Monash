const landingPage = document.getElementById("landing-page");
const viewerShell = document.getElementById("viewer-shell");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const continentFilter = document.getElementById("continent-filter");
const countryFilter = document.getElementById("country-filter");
const siteCards = Array.from(document.querySelectorAll(".site-card"));
const siteCount = document.getElementById("site-count");
const emptyState = document.getElementById("empty-state");

let viewerPromise = null;
let activeSite = null;

const sites = {
    "candi-sewu": { name: "Candi Sewu" },
    "hongsheng-temple": { name: "Hongsheng Temple Pagoda" },
    "jianshui-confucius": { name: "Jianshui Confucius Temple" }
};

function updateFilters() {
    const continent = continentFilter.value;
    const country = countryFilter.value;
    let visibleCount = 0;

    siteCards.forEach((card) => {
        const matchesContinent = continent === "all" || card.dataset.continent === continent;
        const matchesCountry = country === "all" || card.dataset.country === country;
        const visible = matchesContinent && matchesCountry;
        card.hidden = !visible;
        if (visible) visibleCount++;
    });

    siteCount.textContent = `${visibleCount} ${visibleCount === 1 ? "adventure" : "adventures"}`;
    emptyState.hidden = visibleCount !== 0;
}

continentFilter.addEventListener("change", updateFilters);
countryFilter.addEventListener("change", updateFilters);

async function openViewer(siteId) {
    const site = sites[siteId];
    if (!site) return;

    if (viewerPromise && activeSite !== siteId) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("site", siteId);
        window.location.assign(nextUrl);
        return;
    }

    activeSite = siteId;
    const viewerUrl = new URL(window.location.href);
    viewerUrl.searchParams.set("site", siteId);
    window.history.replaceState({}, "", viewerUrl);

    landingPage.hidden = true;
    viewerShell.classList.add("active");
    viewerShell.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (!viewerPromise) {
        loadingText.textContent = `Preparing ${site.name}...`;
        loadingOverlay.classList.remove("hidden");
        viewerPromise = import("./viewer.js").catch((error) => {
            viewerPromise = null;
            const usingLiveServer = window.location.port === "5500";
            loadingText.textContent = usingLiveServer
                ? "This 3D viewer requires Vite. Run npm run dev and open port 5173."
                : "Unable to load this experience. Check the browser console for details.";
            console.error(error);
            throw error;
        });
    }

    await viewerPromise;
}

document.querySelectorAll(".explore-site").forEach((button) => {
    button.addEventListener("click", () => openViewer(button.dataset.site));
});

document.getElementById("back-to-sites").addEventListener("click", () => {
    if (document.pointerLockElement) document.exitPointerLock();
    viewerShell.classList.remove("active");
    viewerShell.setAttribute("aria-hidden", "true");
    landingPage.hidden = false;
    document.body.style.overflow = "";
    const landingUrl = new URL(window.location.href);
    landingUrl.searchParams.delete("site");
    window.history.replaceState({}, "", landingUrl);
    window.scrollTo({ top: document.getElementById("explore").offsetTop - 20, behavior: "smooth" });
});

updateFilters();

const requestedSite = new URLSearchParams(window.location.search).get("site");
if (requestedSite && sites[requestedSite]) {
    requestAnimationFrame(() => openViewer(requestedSite));
}
