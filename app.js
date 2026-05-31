/**
 * เครื่องคำนวณโครงการไทยช่วยไทย พลัส (60/40)
 * JavaScript Logic & State Management
 */

// คีย์สำหรับบันทึกข้อมูลใน LocalStorage
const STORAGE_KEY = 'th_help_th_transactions';

// State หลักของแอปพลิเคชัน
let state = {
    transactions: [],
    simulatedTime: null, // เก็บ timestamp สำหรับจำลองเวลา (ถ้ามี)
    currentInput: 0 // ยอดเงินที่ผู้ใช้กำลังป้อน ณ ปัจจุบัน
};

// เริ่มต้นโหลดข้อมูลเมื่อแอปเริ่มทำงาน
function initApp() {
    loadTransactions();
    setupEventListeners();
    setupHelperCalculator();
    updateUI();
}

// โหลดรายการจาก LocalStorage
function loadTransactions() {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
        try {
            state.transactions = JSON.parse(rawData);
            // แปลง timestamp ที่โหลดมาให้มั่นใจว่าเป็น number
            state.transactions.forEach(t => {
                t.timestamp = Number(t.timestamp);
                t.amount = Number(t.amount);
                t.govSubsidy = Number(t.govSubsidy);
                t.userPay = Number(t.userPay);
            });
        } catch (e) {
            console.error("ล้มเหลวในการอ่านข้อมูลประวัติ:", e);
            state.transactions = [];
        }
    } else {
        state.transactions = [];
    }
}

// บันทึกรายการลง LocalStorage
function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

// ดึงวันเวลาปัจจุบัน (โดยคำนึงถึงฟังก์ชันจำลองเวลา Time Travel)
function getCurrentDate() {
    if (state.simulatedTime) {
        return new Date(state.simulatedTime);
    }
    return new Date();
}

// ตรวจสอบว่าเป็นวันเดียวกันหรือไม่ (เทียบปี-เดือน-วัน)
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

// ตรวจสอบว่าเป็นเดือนเดียวกันหรือไม่ (เทียบปี-เดือน)
function isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth();
}

// คำนวณยอดเงินที่รัฐช่วยไปแล้วในวันนี้
function getGovSubsidyUsedToday(date) {
    return state.transactions
        .filter(t => isSameDay(new Date(t.timestamp), date))
        .reduce((sum, t) => sum + t.govSubsidy, 0);
}

// คำนวณยอดเงินที่รัฐช่วยไปแล้วในเดือนนี้
function getGovSubsidyUsedThisMonth(date) {
    return state.transactions
        .filter(t => isSameMonth(new Date(t.timestamp), date))
        .reduce((sum, t) => sum + t.govSubsidy, 0);
}

/**
 * คำนวณผลลัพธ์ส่วนแบ่งจ่ายจริงและสิทธิรัฐช่วยสำหรับยอดเงินที่กำหนด
 * @param {number} purchaseAmount - ยอดซื้อรวม
 * @returns {object} ผลลัพธ์คำนวณ { govSubsidy, userPay, isDailyCapped, isMonthlyCapped }
 */
function calculateCopay(purchaseAmount) {
    if (isNaN(purchaseAmount) || purchaseAmount <= 0) {
        return { govSubsidy: 0, userPay: 0, isDailyCapped: false, isMonthlyCapped: false, excessPay: 0 };
    }

    const currentDate = getCurrentDate();
    const govUsedToday = getGovSubsidyUsedToday(currentDate);
    const govUsedThisMonth = getGovSubsidyUsedThisMonth(currentDate);

    // โควตาคงเหลือรายวันและรายเดือน (รัฐช่วยได้สูงสุด 200 ต่อวัน, 1000 ต่อเดือน)
    const dailyLimitRemaining = Math.max(0, 200 - govUsedToday);
    const monthlyLimitRemaining = Math.max(0, 1000 - govUsedThisMonth);

    // ยอดช่วยเหลือที่ควรจะได้ตามเกณฑ์ 60%
    const expectedGovSubsidy = purchaseAmount * 0.60;

    // รัฐช่วยจริงโดยดูเกณฑ์สิทธิคงเหลือ (หาค่าน้อยที่สุดระหว่าง 60%, สิทธิวันเหลือ, สิทธิเดือนเหลือ)
    let actualGovSubsidy = Math.min(expectedGovSubsidy, dailyLimitRemaining, monthlyLimitRemaining);
    actualGovSubsidy = Math.max(0, actualGovSubsidy); // ป้องกันค่าติดลบ

    // ปัดเศษทศนิยม 2 ตำแหน่ง
    actualGovSubsidy = Math.round(actualGovSubsidy * 100) / 100;
    const userPay = Math.round((purchaseAmount - actualGovSubsidy) * 100) / 100;

    // สถานะเตือนเมื่อสิทธิถูกจำกัด (Capped)
    const isDailyCapped = (expectedGovSubsidy > dailyLimitRemaining) && (actualGovSubsidy === Math.round(dailyLimitRemaining * 100) / 100) && dailyLimitRemaining < expectedGovSubsidy;
    const isMonthlyCapped = (expectedGovSubsidy > monthlyLimitRemaining) && (actualGovSubsidy === Math.round(monthlyLimitRemaining * 100) / 100) && monthlyLimitRemaining < expectedGovSubsidy;

    // คำนวณส่วนเกินที่ผู้ใช้ต้องรับภาระเพิ่มเนื่องจากชนเพดาน (รัฐช่วยได้น้อยลง)
    let excessPay = 0;
    if (isDailyCapped || isMonthlyCapped || (actualGovSubsidy === 0 && expectedGovSubsidy > 0)) {
        excessPay = Math.max(0, expectedGovSubsidy - actualGovSubsidy);
        excessPay = Math.round(excessPay * 100) / 100;
    }

    return {
        govSubsidy: actualGovSubsidy,
        userPay: userPay,
        isDailyCapped: isDailyCapped,
        isMonthlyCapped: isMonthlyCapped,
        excessPay: excessPay
    };
}

// เพิ่มรายการธุรกรรมใหม่
function addTransaction(amount, note = '') {
    if (isNaN(amount) || amount <= 0) {
        showToast("กรุณากรอกยอดเงินที่ถูกต้อง", "error");
        return false;
    }

    const currentDate = getCurrentDate();
    const result = calculateCopay(amount);

    if (result.govSubsidy <= 0 && amount > 0) {
        // ถ้ารัฐช่วยได้ 0 บาท เพราะสิทธิเต็มแล้ว ให้แจ้งเตือน แต่ยังยินยอมให้บันทึกได้โดยผู้ใช้จ่ายเองเต็มจำนวน
        showToast(`โควตาสิทธิคงเหลือของคุณหมดแล้ว รายการนี้คุณต้องจ่ายเองเพิ่มอีก ${formatCurrency(result.excessPay)} บ.`, "warning");
    } else if (result.isDailyCapped) {
        showToast(`ส่วนลดบางส่วนถูกจำกัดเนื่องจากชนเพดานสิทธิรายวัน (ต้องจ่ายเพิ่มเองอีก ${formatCurrency(result.excessPay)} บ.)`, "warning");
    } else if (result.isMonthlyCapped) {
        showToast(`ส่วนลดบางส่วนถูกจำกัดเนื่องจากชนเพดานสิทธิรายเดือน (ต้องจ่ายเพิ่มเองอีก ${formatCurrency(result.excessPay)} บ.)`, "warning");
    } else {
        showToast("บันทึกรายการใช้จ่ายเรียบร้อยแล้ว", "success");
    }

    const newTransaction = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: currentDate.getTime(),
        amount: Number(amount),
        govSubsidy: result.govSubsidy,
        userPay: result.userPay,
        note: note.trim() || 'รายการทั่วไป'
    };

    state.transactions.unshift(newTransaction); // เอาไว้ด้านบนสุด
    saveTransactions();
    updateUI();

    // เคลียร์ค่าหลังจากบันทึกสำเร็จ
    document.getElementById('amount-input').value = '';
    document.getElementById('note-input').value = '';
    state.currentInput = 0;
    updateCalculationPreview();
    
    return true;
}

// ลบรายการธุรกรรม
function deleteTransaction(id) {
    Swal.fire({
        title: 'ต้องการลบรายการนี้?',
        text: 'เมื่อลบแล้ว สิทธิคงเหลือจะถูกคำนวณใหม่โดยอัตโนมัติ',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48', // rose-600
        cancelButtonColor: '#64748b', // slate-500
        confirmButtonText: 'ใช่, ลบเลย!',
        cancelButtonText: 'ยกเลิก',
        background: '#ffffff',
        customClass: {
            popup: 'rounded-3xl shadow-xl border border-slate-100 font-prompt',
            confirmButton: 'px-5 py-2.5 bg-rose-600 text-white rounded-xl font-semibold text-sm transition hover:bg-rose-700 focus:outline-none mr-2',
            cancelButton: 'px-5 py-2.5 bg-slate-500 text-white rounded-xl font-semibold text-sm transition hover:bg-slate-600 focus:outline-none ml-2'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            state.transactions = state.transactions.filter(t => t.id !== id);
            recalculateAllTransactions();
            updateUI();
            showToast("ลบรายการเรียบร้อยแล้ว", "success");
        }
    });
}

// คำนวณยอดสิทธิของประวัติรายการทั้งหมดใหม่ จากอดีตมาปัจจุบัน (เพื่อให้สิทธิเรียงสะสมถูกต้อง)
function recalculateAllTransactions() {
    // เรียงจากเก่าไปใหม่เพื่อคำนวณสะสม
    const sorted = [...state.transactions].sort((a, b) => a.timestamp - b.timestamp);
    
    const dailyGovSum = {};
    const monthlyGovSum = {};

    for (let t of sorted) {
        const date = new Date(t.timestamp);
        const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;

        if (!dailyGovSum[dayKey]) dailyGovSum[dayKey] = 0;
        if (!monthlyGovSum[monthKey]) monthlyGovSum[monthKey] = 0;

        const dailyLimitRemaining = Math.max(0, 200 - dailyGovSum[dayKey]);
        const monthlyLimitRemaining = Math.max(0, 1000 - monthlyGovSum[monthKey]);

        const expectedGovSubsidy = t.amount * 0.60;
        let actualGovSubsidy = Math.min(expectedGovSubsidy, dailyLimitRemaining, monthlyLimitRemaining);
        actualGovSubsidy = Math.max(0, actualGovSubsidy);
        actualGovSubsidy = Math.round(actualGovSubsidy * 100) / 100;
        
        const userPay = Math.round((t.amount - actualGovSubsidy) * 100) / 100;

        t.govSubsidy = actualGovSubsidy;
        t.userPay = userPay;

        dailyGovSum[dayKey] += actualGovSubsidy;
        monthlyGovSum[monthKey] += actualGovSubsidy;
    }

    // เซ็ตกลับ และบันทึก
    state.transactions = sorted.reverse();
    saveTransactions();
}

// แก้ไขรายการธุรกรรม
function editTransaction(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    Swal.fire({
        title: 'แก้ไขรายการใช้จ่าย',
        html: `
            <div class="flex flex-col gap-4 text-left font-prompt">
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-slate-500">ยอดซื้อสินค้า/บริการ (บาท)</label>
                    <input id="swal-amount" type="text" inputmode="decimal" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value="${tx.amount}">
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-slate-500">บันทึกช่วยจำ</label>
                    <input id="swal-note" type="text" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value="${escapeHtml(tx.note)}">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#0f2a4a', // govNavy
        cancelButtonColor: '#64748b', // slate-500
        confirmButtonText: 'บันทึกการแก้ไข',
        cancelButtonText: 'ยกเลิก',
        background: '#ffffff',
        customClass: {
            popup: 'rounded-3xl shadow-xl border border-slate-100 font-prompt',
            confirmButton: 'px-5 py-2.5 bg-govNavy text-white rounded-xl font-semibold text-sm transition hover:bg-govNavy-light focus:outline-none mr-2',
            cancelButton: 'px-5 py-2.5 bg-slate-500 text-white rounded-xl font-semibold text-sm transition hover:bg-slate-600 focus:outline-none ml-2'
        },
        buttonsStyling: false,
        didOpen: () => {
            const swalAmount = document.getElementById('swal-amount');
            if (swalAmount) {
                swalAmount.addEventListener('input', function() {
                    let val = this.value;
                    val = val.replace(/[^0-9.]/g, '');
                    const dotIndex = val.indexOf('.');
                    if (dotIndex !== -1) {
                        val = val.slice(0, dotIndex + 1) + val.slice(dotIndex + 1).replace(/\./g, '');
                    }
                    this.value = val;
                });
            }
        },
        preConfirm: () => {
            const amountVal = document.getElementById('swal-amount').value;
            const noteVal = document.getElementById('swal-note').value;
            const amount = parseFloat(amountVal);
            if (isNaN(amount) || amount <= 0) {
                Swal.showValidationMessage('กรุณากรอกยอดเงินที่ถูกต้องและมากกว่า 0');
                return false;
            }
            return { amount, note: noteVal };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            tx.amount = result.value.amount;
            tx.note = result.value.note.trim() || 'รายการทั่วไป';
            
            recalculateAllTransactions();
            updateUI();
            showToast("แก้ไขรายการเรียบร้อยแล้ว", "success");
        }
    });
}

// รีเซ็ตข้อมูลทั้งหมด
function resetAllData() {
    Swal.fire({
        title: 'ยืนยันการล้างข้อมูลทั้งหมด?',
        text: 'ประวัติธุรกรรมทั้งหมดจะถูกลบ และรีเซ็ตสิทธิกลับมาเริ่มต้นใหม่ (ไม่สามารถกู้คืนได้!)',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48', // rose-600
        cancelButtonColor: '#64748b', // slate-500
        confirmButtonText: 'ใช่, รีเซ็ตเลย!',
        cancelButtonText: 'ยกเลิก',
        background: '#ffffff',
        customClass: {
            popup: 'rounded-3xl shadow-xl border border-slate-100 font-prompt',
            confirmButton: 'px-5 py-2.5 bg-rose-600 text-white rounded-xl font-semibold text-sm transition hover:bg-rose-700 focus:outline-none mr-2',
            cancelButton: 'px-5 py-2.5 bg-slate-500 text-white rounded-xl font-semibold text-sm transition hover:bg-slate-600 focus:outline-none ml-2'
        },
        buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            state.transactions = [];
            state.simulatedTime = null;
            saveTransactions();
            
            // เคลียร์ input ในแผงจำลองเวลา
            const timeInput = document.getElementById('sim-time-input');
            if (timeInput) timeInput.value = '';
            
            updateUI();
            showToast("รีเซ็ตข้อมูลทั้งหมดเรียบร้อยแล้ว", "success");
        }
    });
}

// อัปเดตการแสดงผลคำนวณแบบ Realtime ขณะพิมพ์
function updateCalculationPreview() {
    const inputVal = parseFloat(document.getElementById('amount-input').value);
    state.currentInput = isNaN(inputVal) ? 0 : inputVal;

    const result = calculateCopay(state.currentInput);

    // อัปเดตส่วนแสดงผลตัวเลขพรีวิว
    document.getElementById('preview-gov').innerText = formatCurrency(result.govSubsidy);
    document.getElementById('preview-user').innerText = formatCurrency(result.userPay);
    document.getElementById('preview-total').innerText = formatCurrency(state.currentInput);

    // แสดง/ซ่อน แผงยอดส่วนเกิน
    const excessContainer = document.getElementById('preview-excess-container');
    const excessDisplay = document.getElementById('preview-excess');
    if (result.excessPay > 0 && excessContainer && excessDisplay) {
        excessDisplay.innerText = formatCurrency(result.excessPay) + " บาท";
        excessContainer.classList.remove('hidden');
    } else if (excessContainer) {
        excessContainer.classList.add('hidden');
    }

    // แสดงคำอธิบายแจ้งเตือนโควตาชนเพดานแบบ Realtime
    const warningText = document.getElementById('preview-warning');
    if (state.currentInput > 0) {
        if (result.govSubsidy === 0) {
            warningText.innerHTML = `<span class="text-rose-600 font-semibold">⚠️ สิทธิการช่วยเหลือหมดแล้ว! คุณต้องจ่ายเอง 100% (ส่วนเกินที่คุณต้องจ่ายเพิ่มเองคือ ${formatCurrency(result.excessPay)} บ.)</span>`;
            warningText.classList.remove('hidden');
        } else if (result.isDailyCapped) {
            warningText.innerHTML = `<span class="text-amber-600 font-semibold">⚠️ ชนเพดานสิทธิรายวัน! รัฐช่วยได้เพียง ${formatCurrency(result.govSubsidy)} บ. (ส่วนที่คุณต้องจ่ายเพิ่มเองคือ ${formatCurrency(result.excessPay)} บ.)</span>`;
            warningText.classList.remove('hidden');
        } else if (result.isMonthlyCapped) {
            warningText.innerHTML = `<span class="text-amber-600 font-semibold">⚠️ ชนเพดานสิทธิรายเดือน! รัฐช่วยได้เพียง ${formatCurrency(result.govSubsidy)} บ. (ส่วนที่คุณต้องจ่ายเพิ่มเองคือ ${formatCurrency(result.excessPay)} บ.)</span>`;
            warningText.classList.remove('hidden');
        } else {
            warningText.innerHTML = `<span class="text-emerald-600 font-semibold">✓ คำนวณตามเกณฑ์รัฐช่วย 60% / คุณจ่าย 40%</span>`;
            warningText.classList.remove('hidden');
        }
    } else {
        warningText.classList.add('hidden');
    }
}

// อัปเดต UI ทั้งหมด
function updateUI() {
    const currentDate = getCurrentDate();
    
    // 1. อัปเดตแถบแสดงวันเวลาจำลอง (ถ้ามี)
    const timeDisplay = document.getElementById('current-time-display');
    const timeLabel = document.getElementById('time-travel-badge');
    
    const formattedDate = currentDate.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    timeDisplay.innerText = formattedDate;

    if (state.simulatedTime) {
        timeLabel.classList.remove('hidden');
        timeLabel.innerHTML = `⏰ กำลังอยู่ในโหมดจำลองวันเวลา`;
    } else {
        timeLabel.classList.add('hidden');
    }

    // 2. คำนวณสิทธิการช่วยเหลือวันนี้และเดือนนี้
    const govUsedToday = getGovSubsidyUsedToday(currentDate);
    const govUsedThisMonth = getGovSubsidyUsedThisMonth(currentDate);

    const dailyLimit = 200;
    const monthlyLimit = 1000;

    const dailyRem = Math.max(0, dailyLimit - govUsedToday);
    const monthlyRem = Math.max(0, monthlyLimit - govUsedThisMonth);

    // อัปเดตตัวเลขคงเหลือ
    document.getElementById('daily-remaining').innerText = formatCurrency(dailyRem);
    document.getElementById('daily-used').innerText = formatCurrency(govUsedToday);
    document.getElementById('monthly-remaining').innerText = formatCurrency(monthlyRem);
    document.getElementById('monthly-used').innerText = formatCurrency(govUsedThisMonth);

    // อัปเดตเกจวงกลม (SVG Dasharray) หรือ Progress Bar
    updateProgressRing('daily-ring', govUsedToday, dailyLimit);
    updateProgressRing('monthly-ring', govUsedThisMonth, monthlyLimit);

    // 3. แสดงรายการประวัติย้อนหลัง (เรียงตามล่าสุด)
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    if (state.transactions.length === 0) {
        historyList.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <svg class="mx-auto h-12 w-12 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                </svg>
                <p class="text-sm">ยังไม่มีประวัติการบันทึกรายการใช้จ่าย</p>
            </div>
        `;
    } else {
        state.transactions.forEach(t => {
            const txDate = new Date(t.timestamp);
            const txTimeStr = txDate.toLocaleDateString('th-TH', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // สร้าง Element แถวประวัติ
            const row = document.createElement('div');
            row.className = "flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition duration-150 border border-slate-100";
            
            row.innerHTML = `
                <div class="flex-1 min-w-0 pr-4">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-semibold text-slate-800 text-sm md:text-base truncate">${escapeHtml(t.note)}</span>
                        <span class="text-xs text-slate-400 shrink-0">${txTimeStr}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>ยอดซื้อรวม: <strong class="text-slate-700">${formatCurrency(t.amount)} บ.</strong></span>
                        <span class="hidden md:inline">•</span>
                        <span>รัฐช่วย: <strong class="text-blue-600">${formatCurrency(t.govSubsidy)} บ.</strong></span>
                        <span class="hidden md:inline">•</span>
                        <span>จ่ายเอง: <strong class="text-emerald-600">${formatCurrency(t.userPay)} บ.</strong></span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="editTransaction('${t.id}')" class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors duration-150" title="แก้ไขรายการ">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteTransaction('${t.id}')" class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors duration-150" title="ลบรายการ">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `;
            historyList.appendChild(row);
        });
    }

    // อัปเดตข้อมูลพรีวิวอีกครั้งหลังปรับปรุง State เผื่อสิทธิเปลี่ยน
    updateCalculationPreview();
}

// อัปเดตสถานะเกจวงกลม SVG
function updateProgressRing(ringId, usedValue, limitValue) {
    const circle = document.getElementById(ringId);
    if (!circle) return;

    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    
    // กำหนดค่า strokeDasharray
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    // คำนวณเปอร์เซ็นต์ (ไม่เกิน 100%)
    const pct = Math.min(100, (usedValue / limitValue) * 100);
    const offset = circumference - (pct / 100) * circumference;
    
    circle.style.strokeDashoffset = offset;

    // อัปเดตสีเกจตามความหนาแน่นการใช้งาน
    const container = circle.parentElement.parentElement;
    const progressPercentText = container.querySelector('.percent-text');
    if (progressPercentText) {
        progressPercentText.innerText = `${Math.round(pct)}%`;
    }

    if (pct >= 100) {
        circle.setAttribute('class', 'text-rose-500 transition-all duration-500 ease-out');
    } else if (pct >= 80) {
        circle.setAttribute('class', 'text-amber-500 transition-all duration-500 ease-out');
    } else {
        circle.setAttribute('class', 'text-blue-600 transition-all duration-500 ease-out');
    }
}

// จัดการเหตุการณ์ต่าง ๆ (Event Listeners)
function setupEventListeners() {
    // ดักจับการพิมพ์ยอดเงิน
    const amountInput = document.getElementById('amount-input');
    amountInput.addEventListener('input', function (e) {
        // กรองตัวอักษรอื่นที่ไม่ใช่ตัวเลขและจุดทศนิยม
        let val = this.value;
        val = val.replace(/[^0-9.]/g, '');
        
        // อนุญาตให้มีจุดทศนิยมได้ตัวเดียวเท่านั้น
        const dotIndex = val.indexOf('.');
        if (dotIndex !== -1) {
            val = val.slice(0, dotIndex + 1) + val.slice(dotIndex + 1).replace(/\./g, '');
        }
        
        this.value = val;
        updateCalculationPreview();
    });

    // ปุ่มฟอร์มส่งข้อมูล (บันทึก)
    const calcForm = document.getElementById('calculator-form');
    calcForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const amount = parseFloat(amountInput.value);
        const note = document.getElementById('note-input').value;
        addTransaction(amount, note);
    });

    // ปุ่มตัวเลขด่วน (Quick amount buttons) สำหรับการใช้งานบนมือถือ
    const quickButtons = document.querySelectorAll('.quick-amount-btn');
    quickButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const val = parseFloat(this.getAttribute('data-value'));
            if (!isNaN(val)) {
                amountInput.value = val;
                updateCalculationPreview();
                // ดึงโฟกัสไปที่ Input
                amountInput.focus();
            }
        });
    });

    // การจำลองการข้ามเวลา (Time Travel)
    const simTimeInput = document.getElementById('sim-time-input');
    const applySimTimeBtn = document.getElementById('apply-sim-time-btn');
    const resetSimTimeBtn = document.getElementById('reset-sim-time-btn');

    if (applySimTimeBtn) {
        applySimTimeBtn.addEventListener('click', function () {
            if (simTimeInput.value) {
                state.simulatedTime = new Date(simTimeInput.value).getTime();
                updateUI();
                showToast("เปลี่ยนวันเวลาจำลองสำเร็จ", "success");
            } else {
                showToast("กรุณาเลือกวันเวลาที่ต้องการจำลอง", "error");
            }
        });
    }

    if (resetSimTimeBtn) {
        resetSimTimeBtn.addEventListener('click', function () {
            state.simulatedTime = null;
            simTimeInput.value = '';
            updateUI();
            showToast("กลับสู่วันเวลาปัจจุบันแล้ว", "success");
        });
    }

    // ปุ่มลบประวัติทั้งหมด
    const resetAllBtn = document.getElementById('reset-all-btn');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', resetAllData);
    }
}

// ฟังก์ชันคำนวณสูตรคณิตศาสตร์อย่างปลอดภัย
function safeEvaluate(expression) {
    if (!expression) return 0;
    
    // ทำความสะอาดสตริง: อนุญาตเฉพาะ ตัวเลข, +, -, *, /, ., ( และ ) เท่านั้น
    let cleanExpr = expression.replace(/\s+/g, '');
    
    // ตรวจสอบโครงสร้างสมการคณิตศาสตร์ที่ถูกต้อง
    if (!/^[0-9+\-*/().]+$/.test(cleanExpr)) {
        return null;
    }
    
    try {
        const evaluator = new Function(`return (${cleanExpr})`);
        const result = evaluator();
        
        if (typeof result === 'number' && isFinite(result)) {
            return Math.round(result * 100) / 100;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// ฟังก์ชันจัดการแป้นพิมพ์เครื่องคิดเลขย่อยช่วยสะสมเงิน
let calcExpr = '';

function setupHelperCalculator() {
    const toggleBtn = document.getElementById('toggle-calc-btn');
    const panel = document.getElementById('helper-calc-panel');
    const closeBtn = document.getElementById('close-calc-btn');
    const clearBtn = document.getElementById('clear-calc-btn');
    const backBtn = document.getElementById('backspace-calc-btn');
    const equalBtn = document.getElementById('calc-equal');
    const applyBtn = document.getElementById('apply-calc-btn');
    
    const exprDisplay = document.getElementById('calc-expression');
    const numDisplay = document.getElementById('calc-display');
    const amountInput = document.getElementById('amount-input');

    if (!panel) return;

    // เปิด-ปิด แผงเครื่องคิดเลข
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            // ดึงค่าเก่าจากช่อง Input ใส่ไว้เป็นค่าเริ่มต้น (ถ้ามี)
            const curVal = amountInput.value.trim();
            if (curVal && !isNaN(curVal) && parseFloat(curVal) > 0) {
                calcExpr = curVal;
                exprDisplay.innerText = '';
                numDisplay.innerText = curVal;
            } else {
                calcExpr = '';
                exprDisplay.innerText = '';
                numDisplay.innerText = '0';
            }
        }
    });

    // ปุ่มปิด
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.classList.add('hidden');
        });
    }

    // ฟังก์ชันอัปเดตหน้าจอเครื่องคิดเลข
    function updateCalcScreen(showRealtimeEval = true) {
        exprDisplay.innerText = calcExpr.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ');
        
        if (calcExpr === '') {
            numDisplay.innerText = '0';
            return;
        }

        if (showRealtimeEval) {
            const evalResult = safeEvaluate(calcExpr);
            if (evalResult !== null) {
                numDisplay.innerText = evalResult;
            }
        }
    }

    // ดักการกดปุ่มบนคีย์แพด
    const keys = document.querySelectorAll('.calc-btn');
    keys.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            if (!val) return; 

            // ป้องกันการใส่ตัวดำเนินการซ้ำซ้อน
            const lastChar = calcExpr.slice(-1);
            const ops = ['+', '-', '*', '/'];
            if (ops.includes(val) && ops.includes(lastChar)) {
                calcExpr = calcExpr.slice(0, -1) + val;
            } else {
                calcExpr += val;
            }
            updateCalcScreen(true);
        });
    });

    // ปุ่มล้างค่า (C)
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            calcExpr = '';
            updateCalcScreen(false);
            numDisplay.innerText = '0';
        });
    }

    // ปุ่มลบตัวหลัง (Backspace)
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (calcExpr.length > 0) {
                calcExpr = calcExpr.slice(0, -1);
                updateCalcScreen(true);
            }
        });
    }

    // ปุ่มคำนวณผลลัพธ์ (=)
    if (equalBtn) {
        equalBtn.addEventListener('click', () => {
            const finalVal = safeEvaluate(calcExpr);
            if (finalVal !== null) {
                calcExpr = finalVal.toString();
                exprDisplay.innerText = '';
                numDisplay.innerText = finalVal;
            } else {
                showToast("รูปแบบสมการไม่ถูกต้อง", "error");
                numDisplay.innerText = 'Error';
            }
        });
    }

    // ปุ่มดึงยอดไปใช้
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const finalVal = safeEvaluate(calcExpr);
            if (finalVal !== null) {
                amountInput.value = finalVal;
                panel.classList.add('hidden');
                updateCalculationPreview();
                showToast(`นำเข้ายอดเงินเรียบร้อยแล้ว: ${formatCurrency(finalVal)} บ.`, "success");
                amountInput.focus();
            } else {
                showToast("ไม่สามารถประเมินผลยอดเงินได้ กรุณาตรวจสอบสูตรคณิตศาสตร์", "error");
            }
        });
    }

    // ปรับปรุงการรองรับคีย์บอร์ดกายภาพเมื่อแผงเปิดอยู่
    document.addEventListener('keydown', (e) => {
        if (panel.classList.contains('hidden')) return;
        
        const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+', '-', '*', '/'];
        if (allowedKeys.includes(e.key)) {
            e.preventDefault();
            const lastChar = calcExpr.slice(-1);
            const ops = ['+', '-', '*', '/'];
            if (ops.includes(e.key) && ops.includes(lastChar)) {
                calcExpr = calcExpr.slice(0, -1) + e.key;
            } else {
                calcExpr += e.key;
            }
            updateCalcScreen(true);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            equalBtn.click();
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            backBtn.click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeBtn.click();
        }
    });
}

// ฟังก์ชันจัดรูปแบบการเงิน
function formatCurrency(value) {
    return Number(value).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ป้องกัน XSS จาก Note บันทึก
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ระบบ Toast Notification แจ้งเตือนสวยงาม
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // สร้าง Toast Element
    const toast = document.createElement('div');
    
    // ตั้งค่า Class สีตามประเภทแจ้งเตือน
    let bgClass = 'bg-slate-800 text-white';
    let icon = '';

    if (type === 'success') {
        bgClass = 'bg-emerald-600 text-white';
        icon = `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
    } else if (type === 'warning') {
        bgClass = 'bg-amber-500 text-slate-900';
        icon = `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else if (type === 'error') {
        bgClass = 'bg-rose-600 text-white';
        icon = `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>`;
    }

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-white/10 ${bgClass} transition-all duration-300 transform translate-y-2 opacity-0 shrink-0 max-w-sm text-sm font-medium z-50`;
    toast.innerHTML = `
        ${icon}
        <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);

    // ดัน Animation ขึ้น
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    // ซ่อนและทำลาย Toast หลังจากผ่านไป 3.5 วินาที
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

// บูตแอปพลิเคชันเมื่อหน้าเว็บพร้อมทำงาน
window.addEventListener('DOMContentLoaded', initApp);
