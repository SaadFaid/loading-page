/* full script.js - robust image handling + smooth progress + tips fade */

/* --- Branding text --- */
$(".center h1").html(name)
$(".center p").html(underName)
$(".center span").html(desc)

/* --- Loading bar helper --- */
function loading(num){
	$("#loadingText").text(num + "%");
	$(".loading-bar .line").css("width", num + "%");
}

/* --- Smooth GTA/FiveM progress --- */
let gtaProgress = 0;
let gtaInterval;
window.addEventListener('message', function(e) {
    if (e.data && e.data.eventName === 'loadProgress') {
    	let target = Math.floor(e.data.loadFraction * 100);
    	clearInterval(gtaInterval);
    	gtaInterval = setInterval(()=>{
    		if (gtaProgress < target){
    			gtaProgress++;
    			loading(gtaProgress);
    		} else {
    			clearInterval(gtaInterval);
    		}
    	}, 12); // smaller = smoother
    }
});

/* --- Local preview auto progress (jump style, 0->100 in 45s) --- */
if (window.location.protocol === "file:" || window.location.hostname === "localhost") {
	let jumpProgress = 0;
	const totalDuration = 45000; // 45s
	const steps = 10;            // number of jumps (10% per step)
	const stepTime = totalDuration / steps;

	let jumpInterval = setInterval(()=>{
		if (jumpProgress < 100) {
			jumpProgress += 100 / steps;
			loading(Math.floor(jumpProgress));
		} else {
			clearInterval(jumpInterval);
		}
	}, stepTime);
}

/* --- Resolve image path robustly --- */
function resolveImagePath(p) {
    if (!p) return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    if (/^https?:\/\//i.test(p)) return p;
    if (/^(?:\.\/)?assets\//i.test(p)) return p.replace(/^\.\//,'');
    if (/^\//.test(p)) return p.replace(/^\//,'');
    return `assets/img/tips/${p}`;
}

/* --- Preload tips images, replace any broken ones with fallback --- */
function preloadTipsImages(tips, cb){
    if (!Array.isArray(tips) || tips.length === 0) { cb(); return; }
    let loaded = 0;
    const total = tips.length;
    const fallback = 'assets/img/tips/placeholder.jpg';

    tips.forEach((tip, i) => {
        if (!tip.img) {
            tips[i].img = fallback;
            loaded++; if (loaded === total) cb();
            return;
        }
        const src = resolveImagePath(tip.img);
        const img = new Image();
        img.onload = () => { loaded++; if (loaded === total) cb(); };
        img.onerror = () => {
            console.warn(`Tip image failed to load: ${src} — using fallback`);
            tips[i].img = fallback;
            loaded++; if (loaded === total) cb();
        };
        img.src = src;
    });
}

/* --- Show tips with fade + dots + progress --- */
function initTipsPanel(){
    if (!showTipList || !Array.isArray(tipsConfig) || tipsConfig.length === 0) return;

    $(".panel.panelInfo").show();
    let currentTip = 0;
    let runningTimeout = null;
    let progressInterval = null;

    function showTip(index){
        clearTimeout(runningTimeout);
        clearInterval(progressInterval);

        const tip = tipsConfig[index];
        const imgSrc = resolveImagePath(tip.img);

        $("#tipsContainer").fadeOut(300, function(){
            $(this).html(`
                <div class="panelItem active">
                    ${tip.img ? `<img src="${imgSrc}" class="tip-img" onerror="this.onerror=null;this.src='assets/img/tips/placeholder.jpg'">` : `<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" class="tip-img">`}
                    <div class="bg">
                        <div class="content">
                            <h2>${tip.title}</h2>
                            <p>${tip.text}</p>
                        </div>
                    </div>
                </div>
            `).fadeIn(350);
        });

        $("#dotsContainer").empty();
        tipsConfig.forEach((_,i) => {
            $("#dotsContainer").append(`<span class="dot ${i===index?'active':''}" data-idx="${i}"></span>`);
        });

        $("#dotsContainer .dot").off('click').on('click', function(){
            const idx = parseInt($(this).attr('data-idx'), 10);
            currentTip = idx;
            showTip(currentTip);
        });

        $("#progressBar").css({ width: '0%' });
        let progress = 0;
        const step = 100 / (tip.timeout * 10);
        progressInterval = setInterval(() => {
            progress += step;
            $("#progressBar").css('width', Math.min(progress,100) + '%');
            if (progress >= 100) {
                clearInterval(progressInterval);
                currentTip = (currentTip + 1) % tipsConfig.length;
                showTip(currentTip);
            }
        }, 100);
    }

    showTip(currentTip);
}

/* --- Kick off preloading then init tips --- */
preloadTipsImages(tipsConfig, function(){
    console.log("All tip images preloaded (or replaced with fallback).");
    initTipsPanel();
});
/* --- Random forward-only loading bar, finishes in 60s --- */
let current = 0;       // current %
let target = 0;        // target %
const totalTime = 60000; // total time in ms
const startTime = Date.now();

function pickNextTarget() {
    const now = Date.now();
    const timeElapsed = now - startTime;
    const timeLeft = totalTime - timeElapsed;

    if (current >= 100 || timeLeft <= 0) {
        current = 100;
        loading(100);
        return;
    }

    // Random jump size: 5–15%, but don't overshoot
    let maxJump = Math.min(15, 100 - current);
    let jump = Math.floor(Math.random() * maxJump) + 5;
    target = current + jump;

    // Random step duration: 0.3–2s
    let stepDuration = (Math.random() * 1700) + 300;

    // Adjust duration so we finish at 100% in time
    const jumpsLeft = Math.ceil((100 - current) / 5);
    const maxStepDuration = Math.max(200, timeLeft / jumpsLeft);
    stepDuration = Math.min(stepDuration, maxStepDuration);

    animateStep(current, target, stepDuration);
}

function animateStep(from, to, stepDuration) {
    const stepStart = Date.now();

    function frame() {
        const now = Date.now();
        let progress = Math.min(1, (now - stepStart) / stepDuration);

        // ease-in-out curve
        let eased = progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

        current = from + (to - from) * eased;
        loading(Math.floor(current));

        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            if (current < 100) {
                // random pause 200–800ms between jumps
                setTimeout(pickNextTarget, Math.random() * 600 + 200);
            } else {
                current = 100;
                loading(100);
            }
        }
    }

    frame();
}

// Start loading
pickNextTarget();
/* --- Socials logic --- */
const socials = { discord, instagram, youtube, twitter, tiktok, facebook, twitch, github };
Object.keys(socials).forEach(key => {
    const link = socials[key];
    if (link && link.trim() !== "") {
        $(`.${key}`).show();
        $(`.${key} a`).attr("href", link).attr("target","_blank").attr("rel","noopener noreferrer");
    }
});

/* --- Theme background --- */
function setTheme(bg) {
	$("body").append(`<style>:root{--main:${bg.color};}</style>`);
	$("body").css("background-image", `url('assets/img/${bg.file}')`);
}
const themes = {
	orange: {color:"255,150,0", file:"orange.jpg"},
	red:    {color:"255,0,0", file:"red.jpg"},
	blue:   {color:"0,163,255", file:"blue.jpg"},
	green:  {color:"65,255,0", file:"green.jpg"},
	pink:   {color:"255,122,237", file:"pink.jpg"},
	purple: {color:"193,67,255", file:"purple.jpg"},
	winter: {color:"255,255,255", file:"winter.jpg"},
};
if (themes[theme]) setTheme(themes[theme]);

/* --- Staff team --- */
if (showStaffTeam && Array.isArray(staff_team) && staff_team.length){
    $(".panel.staffteam").show();
    staff_team.forEach(u => {
        $(".staff_team").append(`
            <div class="staff">
                <div class="info">
                    <img src="${u.image || 'assets/img/staff/default.jpg'}" class="pfp" onerror="this.onerror=null;this.src='assets/img/staff/default.jpg'">
                    <p>${u.name}</p>
                </div>
                <p class="status">${u.rank}</p>
            </div>
        `);
    });
}

/* --- Audio / video & controls --- */
let a, vl, isMute=false, isPaused=false;
if (localAudio) {
    $('body').append('<audio id="audioPlayer" src="audio.mp3" loop autoplay></audio>');
    a = $('#audioPlayer');
    a[0].volume = 1;
    a[0].play().catch(()=>{ console.log("Autoplay blocked by browser; user interaction required."); });
}
if (enableLocalVideo) {
    $('body').append('<video id="videoPlayer" autoplay loop><source src="video.webm" type="video/webm"></video>');
    vl = $('#videoPlayer');
    vl[0].play().catch(()=>{});
}

function toggleMute(btn) {
    isMute = !isMute;
    if (a && a[0]) a[0].muted = isMute;
    if (vl && vl[0]) vl[0].muted = isMute;
    $(btn).html(isMute ? '<i class="bi bi-volume-mute"></i>' : '<i class="bi bi-volume-up"></i>');
}
function togglePause(btn) {
    isPaused = !isPaused;
    if (a && a[0]) isPaused ? a[0].pause() : a[0].play();
    if (vl && vl[0]) isPaused ? vl[0].pause() : vl[0].play();
    $(btn).html(isPaused ? '<i class="bi bi-play"></i>' : '<i class="bi bi-pause"></i>');
}
function setVolume(val) {
    const vol = Math.max(0, Math.min(100, Number(val)));
    if (a && a[0]) a[0].volume = vol / 100;
    if (vl && vl[0]) vl[0].volume = vol / 100;
    $("#volumeVal").text(vol + "%");
}

/* --- helpful debug hint message --- */
console.log("script.js loaded — check console/network if images don't show. Tip folder expected: assets/img/tips/");
