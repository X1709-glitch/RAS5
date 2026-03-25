// 1. دالة التنسيق AM/PM
function formatTime12(time24) {
    if (!time24) return "-";
    let [hours, minutes] = time24.split(':');
    hours = parseInt(hours);
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12 || 12;
    return `${h12}:${minutes.padStart(2, '0')} ${ampm}`;
}

// 2. الدالة المسؤولة عن الحسابات والعرض
function updatePrayerLogic(times) {
    const toMin = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    
    const fromMin = (m) => {
        let h = Math.floor(m / 60) % 24;
        let min = Math.round(m % 60);
        return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };

    if (times.Maghrib && times.Fajr) {
        // --- الضبط الذهبي لمطابقة أوقاف أبوظبي (تعديلاتك المعتمدة) ---
        const finalTimes = {
            fajr: fromMin(toMin(times.Fajr)),    
            sunrise: fromMin(toMin(times.Sunrise) - 4),
            dhuhr: fromMin(toMin(times.Dhuhr) - 1),  
            asr: fromMin(toMin(times.Asr) + 1),      
            maghrib: times.Maghrib,                  
            isha: fromMin(toMin(times.Isha))     
        };

        // عرض المواقيت في العناصر
        const elements = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = formatTime12(finalTimes[id]);
        });

        // حساب الدقائق للنهي والتنبيهات
        const fajrMin = toMin(finalTimes.fajr);
        const sunrMin = toMin(finalTimes.sunrise);
        const dhuhrMin = toMin(finalTimes.dhuhr);
        const asrMin = toMin(finalTimes.asr);
        const maghMin = toMin(finalTimes.maghrib);

        // --- حساب أوقات النهي الخمسة للعرض ---
        const f1 = `${formatTime12(fromMin(fajrMin))} - ${formatTime12(fromMin(sunrMin))}`;
        const f2 = `${formatTime12(fromMin(sunrMin))} - ${formatTime12(fromMin(sunrMin + 15))}`;
        const f3 = `${formatTime12(fromMin(dhuhrMin - 10))} - ${formatTime12(fromMin(dhuhrMin))}`;
        const f4 = `${formatTime12(fromMin(asrMin))} - ${formatTime12(fromMin(maghMin - 40))}`;
        const f5 = `${formatTime12(fromMin(maghMin - 40))} - ${formatTime12(fromMin(maghMin))}`;

        if(document.getElementById('forbid-fajr-subh')) document.getElementById('forbid-fajr-subh').innerText = f1;
        if(document.getElementById('forbid-sunrise')) document.getElementById('forbid-sunrise').innerText = f2;
        if(document.getElementById('forbid-noon')) document.getElementById('forbid-noon').innerText = f3;
        if(document.getElementById('forbid-asr-golden')) document.getElementById('forbid-asr-golden').innerText = f4;
        if(document.getElementById('forbid-sunset')) document.getElementById('forbid-sunset').innerText = f5;

        // حساب منتصف الليل واصفرار الشمس
        let midnight = maghMin + ((fajrMin + 1440) - maghMin) / 2;
        document.getElementById('midnight-result').innerText = formatTime12(fromMin(midnight));
        document.getElementById('golden-hour-result').innerText = formatTime12(fromMin(maghMin - 40));

        // تشغيل نظام التنبيهات وعداد الإقامة
        startPrayerWatch(finalTimes);
        
        // تحديث حالة النهي (مختصرة وصامتة)
        checkCurrentForbiddenStatus(fajrMin, sunrMin, dhuhrMin, asrMin, maghMin);
    }
}

function startPrayerWatch(finalTimes) {
    const toSeconds = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 3600 + m * 60;
    };

    if (window.prayerInterval) clearInterval(window.prayerInterval);
    
    window.prayerInterval = setInterval(() => {
        const now = new Date();
        const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const notifText = document.getElementById('notif-text');
        const iqamaDiv = document.getElementById('iqama-timer');
        const timerSpan = document.getElementById('timer-min');

        if (!notifText) return;

        let status = "idle"; 
        let remainingSec = -1;
        let currentPrayerName = "";
        let nextPrayerName = "";
        let nextPrayerSec = -1;

        const prayersOrder = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const prayersNames = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
        
        // 1. فحص إذا كنا في وقت أذان أو إقامة حالياً
        for (let i = 0; i < prayersOrder.length; i++) {
            let p = prayersOrder[i];
            let pSec = toSeconds(finalTimes[p]);
            let athanDuration = 120; // دقيقتين أذان
            
            let iqamaWait = 1200; // 20 دقيقة افتراضي
            if (p === 'fajr') iqamaWait = 1500;
            if (p === 'maghrib') iqamaWait = 300;

            if (currentSec >= pSec && currentSec < pSec + athanDuration) {
                status = "athan";
                currentPrayerName = prayersNames[p];
                break;
            } else if (currentSec >= pSec + athanDuration && currentSec < pSec + iqamaWait) {
                status = "iqama";
                remainingSec = (pSec + iqamaWait) - currentSec;
                break;
            }
        }

        // 2. حساب الوقت للصلاة القادمة إذا كنا في وضع الانتظار (idle)
        if (status === "idle") {
            for (let i = 0; i < prayersOrder.length; i++) {
                let pSec = toSeconds(finalTimes[prayersOrder[i]]);
                if (pSec > currentSec) {
                    nextPrayerSec = pSec - currentSec;
                    nextPrayerName = prayersNames[prayersOrder[i]];
                    break;
                }
            }
            if (nextPrayerSec === -1) {
                nextPrayerSec = (24 * 3600 - currentSec) + toSeconds(finalTimes['fajr']);
                nextPrayerName = "الفجر";
            }
        }

        // تنسيق الوقت المتبقي (ساعة:دقيقة:ثانية) أو (دقيقة:ثانية)
        const formatDisplay = (totalSecs) => {
            let h = Math.floor(totalSecs / 3600);
            let m = Math.floor((totalSecs % 3600) / 60);
            let s = totalSecs % 60;
            
            if (h > 0) {
                return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            return `${m}:${s.toString().padStart(2, '0')}`;
        };

        if (status === "athan") {
            notifText.innerText = `📢 يحين الآن موعد أذان ${currentPrayerName}`;
            if(iqamaDiv) iqamaDiv.style.display = 'none';
        } else if (status === "iqama") {
            notifText.innerText = "باقي على الإقامة"; // تغيير النص ليكون أنسب للعداد
            if(iqamaDiv) {
                iqamaDiv.style.display = 'block';
                timerSpan.innerText = formatDisplay(remainingSec);
                timerSpan.style.color = "#ff4d4d"; // لون أحمر للتنبيه بقرب الإقامة
            }
        } else {
            notifText.innerText = `باقي على ${nextPrayerName}`;
            if(iqamaDiv) {
                iqamaDiv.style.display = 'block';
                timerSpan.innerText = formatDisplay(nextPrayerSec);
                timerSpan.style.color = "var(--accent-cyan)"; // لون سماوي هادئ للانتظار
            }
        }
    }, 1000);
}

// 1. دالة التنسيق AM/PM (مع إضافة علامة LTR لمنع انقلاب الشرطة)
function formatTime12(time24) {
    if (!time24) return "-";
    let [hours, minutes] = time24.split(':');
    hours = parseInt(hours);
    let ampm = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12 || 12;
    // علامة \u200E تضمن أن النص يبدأ من اليسار لليمين حتى لو المتصفح عربي
    return `\u200E${h12}:${minutes.padStart(2, '0')} ${ampm}`;
}

const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const fromMin = (m) => {
    let h = Math.floor(m / 60) % 24;
    let min = Math.round(m % 60);
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
};

// 2. الدالة الأساسية لحساب وعرض أوقات النهي فقط
function updateForbiddenLogic(times) {
    if (!times.Fajr || !times.Maghrib) return;

    // --- المواقيت المعتمدة (أبوظبي) ---
    const fajrMin = toMin(times.Fajr);
    const sunrMin = toMin(fromMin(toMin(times.Sunrise) - 4)); // تعديل الشروق حسب طلبك
    const dhuhrMin = toMin(fromMin(toMin(times.Dhuhr) - 1)); // تعديل الظهر
    const asrMin = toMin(fromMin(toMin(times.Asr) + 1));     // تعديل العصر
    const maghMin = toMin(times.Maghrib);

    // --- حساب وعرض الفترات الخمس ---
    // استخدمنا \u002D لضمان ثبات شكل الشرطة
    const f1 = `${formatTime12(fromMin(fajrMin))} - ${formatTime12(fromMin(sunrMin))}`;
    const f2 = `${formatTime12(fromMin(sunrMin))} - ${formatTime12(fromMin(sunrMin + 15))}`;
    const f3 = `${formatTime12(fromMin(dhuhrMin - 10))} - ${formatTime12(fromMin(dhuhrMin))}`;
    const f4 = `${formatTime12(fromMin(asrMin))} - ${formatTime12(fromMin(maghMin - 40))}`;
    const f5 = `${formatTime12(fromMin(maghMin - 40))} - ${formatTime12(fromMin(maghMin))}`;

    // الربط مع الـ HTML
    if(document.getElementById('forbid-fajr-subh')) document.getElementById('forbid-fajr-subh').innerText = f1;
    if(document.getElementById('forbid-sunrise')) document.getElementById('forbid-sunrise').innerText = f2;
    if(document.getElementById('forbid-noon')) document.getElementById('forbid-noon').innerText = f3;
    if(document.getElementById('forbid-asr-golden')) document.getElementById('forbid-asr-golden').innerText = f4;
    if(document.getElementById('forbid-sunset')) document.getElementById('forbid-sunset').innerText = f5;

    // تشغيل فحص الحالة (هل نحن في وقت نهي الآن؟)
    checkCurrentForbiddenStatus(fajrMin, sunrMin, dhuhrMin, asrMin, maghMin);
}

// 3. دالة فحص الحالة (تظهر فقط وقت النهي وتختفي غير ذلك)
function checkCurrentForbiddenStatus(fajr, sunrise, dhuhr, asr, maghrib) {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const statusEl = document.getElementById('forbidden-status');
    if (!statusEl) return;

    // فترات النهي: بعد الفجر للطلوع+15، قبل الظهر بـ 10، ومن العصر للمغرب
    let isForbidden = (current >= fajr && current < sunrise + 15) || 
                      (current >= dhuhr - 10 && current < dhuhr) || 
                      (current >= asr && current < maghrib);

    if (isForbidden) {
        statusEl.innerText = "⚠️ وقت نهي";
        statusEl.style.display = "inline-block";
    } else {
        statusEl.innerText = "";
        statusEl.style.display = "none"; 
    }
}

// 5. جلب البيانات الأساسية
async function getTimes() {
    const lat = 24.4539;
    const lon = 54.3773;
    const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=16&_=${new Date().getTime()}`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        updatePrayerLogic(data.data.timings);
    } catch (error) {
        console.error("خطأ في الجلب:", error);
    }
}

getTimes();
setInterval(getTimes, 600000);