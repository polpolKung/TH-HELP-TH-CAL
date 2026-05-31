/**
 * ===================================================================
 * QA Test Suite — เครื่องคำนวณโครงการไทยช่วยไทย พลัส (60/40)
 * ===================================================================
 * ทดสอบ Pure Logic ทั้งหมดโดยไม่ต้องพึ่งพา Browser DOM
 * รันด้วย: node tests/qa-test.js
 * ===================================================================
 */

// ============================================================
// ส่วนที่ 1: จำลองฟังก์ชัน Core จาก app.js (Extract Pure Logic)
// ============================================================

let testState = {
    transactions: [],
    simulatedTime: null,
};

function getCurrentDate() {
    if (testState.simulatedTime) {
        return new Date(testState.simulatedTime);
    }
    return new Date();
}

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth();
}

function getGovSubsidyUsedToday(date) {
    return testState.transactions
        .filter(t => isSameDay(new Date(t.timestamp), date))
        .reduce((sum, t) => sum + t.govSubsidy, 0);
}

function getGovSubsidyUsedThisMonth(date) {
    return testState.transactions
        .filter(t => isSameMonth(new Date(t.timestamp), date))
        .reduce((sum, t) => sum + t.govSubsidy, 0);
}

function calculateCopay(purchaseAmount) {
    if (isNaN(purchaseAmount) || purchaseAmount <= 0) {
        return { govSubsidy: 0, userPay: 0, isDailyCapped: false, isMonthlyCapped: false };
    }

    const currentDate = getCurrentDate();
    const govUsedToday = getGovSubsidyUsedToday(currentDate);
    const govUsedThisMonth = getGovSubsidyUsedThisMonth(currentDate);

    const dailyLimitRemaining = Math.max(0, 200 - govUsedToday);
    const monthlyLimitRemaining = Math.max(0, 1000 - govUsedThisMonth);

    const expectedGovSubsidy = purchaseAmount * 0.60;

    let actualGovSubsidy = Math.min(expectedGovSubsidy, dailyLimitRemaining, monthlyLimitRemaining);
    actualGovSubsidy = Math.max(0, actualGovSubsidy);

    actualGovSubsidy = Math.round(actualGovSubsidy * 100) / 100;
    const userPay = Math.round((purchaseAmount - actualGovSubsidy) * 100) / 100;

    const isDailyCapped = (expectedGovSubsidy > dailyLimitRemaining) && (actualGovSubsidy === Math.round(dailyLimitRemaining * 100) / 100) && dailyLimitRemaining < expectedGovSubsidy;
    const isMonthlyCapped = (expectedGovSubsidy > monthlyLimitRemaining) && (actualGovSubsidy === Math.round(monthlyLimitRemaining * 100) / 100) && monthlyLimitRemaining < expectedGovSubsidy;

    return {
        govSubsidy: actualGovSubsidy,
        userPay: userPay,
        isDailyCapped: isDailyCapped,
        isMonthlyCapped: isMonthlyCapped
    };
}

// จำลอง addTransaction แบบไม่มี DOM
function addTransactionTest(amount, note, timestamp) {
    const result = calculateCopay(amount);
    const tx = {
        id: 'tx_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: timestamp || getCurrentDate().getTime(),
        amount: Number(amount),
        govSubsidy: result.govSubsidy,
        userPay: result.userPay,
        note: note || 'test'
    };
    testState.transactions.unshift(tx);
    return { tx, result };
}

function safeEvaluate(expression) {
    if (!expression) return 0;
    let cleanExpr = expression.replace(/\s+/g, '');
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

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================
// ส่วนที่ 2: Test Framework (Minimal)
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failedDetails = [];

function resetState() {
    testState.transactions = [];
    testState.simulatedTime = null;
}

function assert(testName, condition, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ PASS: ${testName}`);
    } else {
        failedTests++;
        const msg = `  ❌ FAIL: ${testName}${details ? ' | ' + details : ''}`;
        console.log(msg);
        failedDetails.push(msg);
    }
}

function assertEqual(testName, actual, expected) {
    totalTests++;
    if (actual === expected) {
        passedTests++;
        console.log(`  ✅ PASS: ${testName}`);
    } else {
        failedTests++;
        const msg = `  ❌ FAIL: ${testName} | Expected: ${expected}, Got: ${actual}`;
        console.log(msg);
        failedDetails.push(msg);
    }
}

function assertApprox(testName, actual, expected, tolerance = 0.01) {
    totalTests++;
    if (Math.abs(actual - expected) <= tolerance) {
        passedTests++;
        console.log(`  ✅ PASS: ${testName}`);
    } else {
        failedTests++;
        const msg = `  ❌ FAIL: ${testName} | Expected: ~${expected}, Got: ${actual} (tolerance: ${tolerance})`;
        console.log(msg);
        failedDetails.push(msg);
    }
}

function section(title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${title}`);
    console.log(`${'='.repeat(60)}`);
}

// ============================================================
// ส่วนที่ 3: Test Cases
// ============================================================

// --- TC-1: การคำนวณ 60/40 ปกติ (ไม่ชนเพดาน) ---
section('TC-1: การคำนวณ 60/40 ปกติ (ไม่ชนเพดาน)');
resetState();

(() => {
    const r1 = calculateCopay(100);
    assertEqual('100 บ. → รัฐช่วย 60 บ.', r1.govSubsidy, 60);
    assertEqual('100 บ. → จ่ายเอง 40 บ.', r1.userPay, 40);
    assert('100 บ. → ไม่ชนเพดานรายวัน', !r1.isDailyCapped);
    assert('100 บ. → ไม่ชนเพดานรายเดือน', !r1.isMonthlyCapped);

    const r2 = calculateCopay(50);
    assertEqual('50 บ. → รัฐช่วย 30 บ.', r2.govSubsidy, 30);
    assertEqual('50 บ. → จ่ายเอง 20 บ.', r2.userPay, 20);

    const r3 = calculateCopay(1);
    assertApprox('1 บ. → รัฐช่วย 0.60 บ.', r3.govSubsidy, 0.60);
    assertApprox('1 บ. → จ่ายเอง 0.40 บ.', r3.userPay, 0.40);

    const r4 = calculateCopay(250);
    assertEqual('250 บ. → รัฐช่วย 150 บ.', r4.govSubsidy, 150);
    assertEqual('250 บ. → จ่ายเอง 100 บ.', r4.userPay, 100);

    const r5 = calculateCopay(333.33);
    assertApprox('333.33 บ. → รัฐช่วย ~200 บ. (จุดพอดีเพดาน)', r5.govSubsidy, 200, 0.01);
    assertApprox('333.33 บ. → จ่ายเอง ~133.33 บ.', r5.userPay, 133.33, 0.01);
})();

// --- TC-2: เพดานสิทธิรายวัน (200 บาท/วัน) ---
section('TC-2: เพดานสิทธิรายวัน (200 บาท/วัน)');
resetState();

(() => {
    const r1 = calculateCopay(400);
    assertEqual('400 บ. → รัฐช่วยล็อกที่ 200 บ.', r1.govSubsidy, 200);
    assertEqual('400 บ. → จ่ายเอง 200 บ.', r1.userPay, 200);
    assert('400 บ. → isDailyCapped = true', r1.isDailyCapped);

    const r2 = calculateCopay(500);
    assertEqual('500 บ. → รัฐช่วยล็อกที่ 200 บ.', r2.govSubsidy, 200);
    assertEqual('500 บ. → จ่ายเอง 300 บ.', r2.userPay, 300);
    assert('500 บ. → isDailyCapped = true', r2.isDailyCapped);

    const r3 = calculateCopay(1000);
    assertEqual('1000 บ. → รัฐช่วยล็อกที่ 200 บ.', r3.govSubsidy, 200);
    assertEqual('1000 บ. → จ่ายเอง 800 บ.', r3.userPay, 800);

    const r4 = calculateCopay(10000);
    assertEqual('10,000 บ. → รัฐช่วยล็อกที่ 200 บ.', r4.govSubsidy, 200);
    assertEqual('10,000 บ. → จ่ายเอง 9,800 บ.', r4.userPay, 9800);
})();

// --- TC-3: สะสมโควตารายวัน (หลายรายการในวันเดียว) ---
section('TC-3: สะสมโควตารายวัน (หลายรายการในวันเดียว)');
resetState();
testState.simulatedTime = new Date(2026, 5, 1, 10, 0, 0).getTime(); // 1 มิ.ย. 2569

(() => {
    // รายการที่ 1: 200 บ. → รัฐช่วย 120 บ.
    const { result: r1 } = addTransactionTest(200, 'รายการที่ 1');
    assertEqual('รายการ 1 (200 บ.) → รัฐช่วย 120 บ.', r1.govSubsidy, 120);
    assertEqual('รายการ 1 → จ่ายเอง 80 บ.', r1.userPay, 80);

    // ตรวจสิทธิคงเหลือ
    const usedDay = getGovSubsidyUsedToday(getCurrentDate());
    assertEqual('ใช้ไปแล้ววันนี้ = 120 บ.', usedDay, 120);

    // รายการที่ 2: 200 บ. → ปกติรัฐช่วย 120 แต่เหลือแค่ 80
    const { result: r2 } = addTransactionTest(200, 'รายการที่ 2');
    assertEqual('รายการ 2 (200 บ.) → รัฐช่วยเหลือ 80 บ. (เพดานเหลือ)', r2.govSubsidy, 80);
    assertEqual('รายการ 2 → จ่ายเอง 120 บ.', r2.userPay, 120);
    assert('รายการ 2 → isDailyCapped = true', r2.isDailyCapped);

    // ตรวจสิทธิหมด
    const usedDay2 = getGovSubsidyUsedToday(getCurrentDate());
    assertEqual('ใช้ไปแล้ววันนี้ = 200 บ. (เต็ม)', usedDay2, 200);

    // รายการที่ 3: โควตาหมด → รัฐช่วย 0 บ.
    const { result: r3 } = addTransactionTest(100, 'รายการที่ 3');
    assertEqual('รายการ 3 (100 บ.) → รัฐช่วย 0 บ. (โควตาเต็ม)', r3.govSubsidy, 0);
    assertEqual('รายการ 3 → จ่ายเองเต็มจำนวน 100 บ.', r3.userPay, 100);
})();

// --- TC-4: เพดานสิทธิรายเดือน (1,000 บาท/เดือน) ---
section('TC-4: เพดานสิทธิรายเดือน (1,000 บาท/เดือน)');
resetState();

(() => {
    // จำลองบันทึก 5 วัน วันละ 200 บ. (ใช้โควตารายวันเต็มทุกวัน = 5 x 200 = 1,000)
    for (let day = 1; day <= 5; day++) {
        testState.simulatedTime = new Date(2026, 5, day, 10, 0, 0).getTime();
        // แต่ละวันซื้อ 400 บ. → รัฐช่วย 200 บ. (ชนเพดานรายวัน)
        addTransactionTest(400, `วันที่ ${day}`);
    }

    const usedMonth = getGovSubsidyUsedThisMonth(new Date(2026, 5, 5));
    assertEqual('หลัง 5 วัน → ใช้สิทธิรายเดือนไป 1,000 บ.', usedMonth, 1000);

    // วันที่ 6: โควตารายเดือนเต็มแล้ว
    testState.simulatedTime = new Date(2026, 5, 6, 10, 0, 0).getTime();
    const r6 = calculateCopay(100);
    assertEqual('วันที่ 6 (100 บ.) → รัฐช่วย 0 บ. (โควตาเดือนเต็ม)', r6.govSubsidy, 0);
    assertEqual('วันที่ 6 → จ่ายเอง 100 บ.', r6.userPay, 100);
    assert('วันที่ 6 → isMonthlyCapped = true', r6.isMonthlyCapped);
})();

// --- TC-5: ข้ามเดือน → สิทธิรีเซ็ตรายเดือน ---
section('TC-5: ข้ามเดือน → สิทธิรีเซ็ตรายเดือน');
resetState();

(() => {
    // เดือนมิถุนายน: ใช้สิทธิเต็ม
    testState.simulatedTime = new Date(2026, 5, 15, 10, 0, 0).getTime();
    for (let i = 0; i < 5; i++) {
        testState.simulatedTime = new Date(2026, 5, 1 + i, 10, 0, 0).getTime();
        addTransactionTest(400, `มิ.ย. วัน ${i+1}`);
    }

    const usedJune = getGovSubsidyUsedThisMonth(new Date(2026, 5, 15));
    assertEqual('มิถุนายน ใช้ = 1,000 บ.', usedJune, 1000);

    // ข้ามไปกรกฎาคม
    testState.simulatedTime = new Date(2026, 6, 1, 10, 0, 0).getTime();
    const usedJuly = getGovSubsidyUsedThisMonth(new Date(2026, 6, 1));
    assertEqual('กรกฎาคม 1 → สิทธิรายเดือนเริ่มใหม่ = 0 บ.', usedJuly, 0);

    const r1 = calculateCopay(100);
    assertEqual('ก.ค. 100 บ. → รัฐช่วย 60 บ. (โควตาเริ่มใหม่)', r1.govSubsidy, 60);
    assert('ก.ค. → ไม่ชนเพดาน', !r1.isDailyCapped && !r1.isMonthlyCapped);
})();

// --- TC-6: ข้ามวัน → สิทธิรีเซ็ตรายวัน แต่รายเดือนยังสะสม ---
section('TC-6: ข้ามวัน → สิทธิรีเซ็ตรายวัน แต่รายเดือนยังสะสม');
resetState();

(() => {
    // วันที่ 1: ใช้สิทธิรายวันเต็ม
    testState.simulatedTime = new Date(2026, 5, 10, 10, 0, 0).getTime();
    addTransactionTest(400, 'วัน 10 รายการ 1');

    const usedDay10 = getGovSubsidyUsedToday(new Date(2026, 5, 10));
    assertEqual('วัน 10 ใช้รายวัน = 200 บ. (เต็ม)', usedDay10, 200);

    // ข้ามไปวันที่ 11
    testState.simulatedTime = new Date(2026, 5, 11, 10, 0, 0).getTime();
    const usedDay11 = getGovSubsidyUsedToday(new Date(2026, 5, 11));
    assertEqual('วัน 11 ใช้รายวัน = 0 บ. (เริ่มใหม่)', usedDay11, 0);

    const usedMonth = getGovSubsidyUsedThisMonth(new Date(2026, 5, 11));
    assertEqual('รายเดือนยังสะสมจากวัน 10 = 200 บ.', usedMonth, 200);

    const r1 = calculateCopay(100);
    assertEqual('วัน 11 (100 บ.) → รัฐช่วย 60 บ.', r1.govSubsidy, 60);
    assert('ไม่ชนเพดาน', !r1.isDailyCapped && !r1.isMonthlyCapped);
})();

// --- TC-7: Edge case - ค่า 0, ค่าติดลบ, NaN ---
section('TC-7: Edge Cases - ค่า 0, ค่าติดลบ, NaN');
resetState();

(() => {
    const r0 = calculateCopay(0);
    assertEqual('0 บ. → รัฐช่วย 0', r0.govSubsidy, 0);
    assertEqual('0 บ. → จ่ายเอง 0', r0.userPay, 0);

    const rNeg = calculateCopay(-100);
    assertEqual('-100 บ. → รัฐช่วย 0', rNeg.govSubsidy, 0);
    assertEqual('-100 บ. → จ่ายเอง 0', rNeg.userPay, 0);

    const rNaN = calculateCopay(NaN);
    assertEqual('NaN → รัฐช่วย 0', rNaN.govSubsidy, 0);

    const rUndef = calculateCopay(undefined);
    assertEqual('undefined → รัฐช่วย 0', rUndef.govSubsidy, 0);

    const rStr = calculateCopay('abc');
    assertEqual('"abc" → รัฐช่วย 0', rStr.govSubsidy, 0);
})();

// --- TC-8: Edge case - ทศนิยมและยอดเงินเล็กน้อย ---
section('TC-8: Edge Cases - ทศนิยมและความแม่นยำ');
resetState();

(() => {
    const r1 = calculateCopay(0.01);
    assertApprox('0.01 บ. → รัฐช่วย 0.01 บ.', r1.govSubsidy, 0.01, 0.005);
    assertApprox('0.01 บ. → จ่ายเอง 0.00 บ.', r1.userPay, 0.00, 0.005);

    const r2 = calculateCopay(99.99);
    assertApprox('99.99 บ. → รัฐช่วย 59.99 บ.', r2.govSubsidy, 59.99, 0.01);
    assertApprox('99.99 บ. → จ่ายเอง 40.00 บ.', r2.userPay, 40.00, 0.01);

    // ทดสอบ rounding: govSubsidy + userPay = purchaseAmount เสมอ
    const r3 = calculateCopay(77.77);
    const sum3 = r3.govSubsidy + r3.userPay;
    assertApprox('77.77 บ. → govSubsidy + userPay = 77.77', sum3, 77.77, 0.01);

    const r4 = calculateCopay(123.456);
    const sum4 = r4.govSubsidy + r4.userPay;
    assertApprox('123.456 บ. → govSubsidy + userPay = 123.456', sum4, 123.456, 0.01);
})();

// --- TC-9: ลบรายการ → โควตาคืน ---
section('TC-9: ลบรายการ → โควตาคืน');
resetState();
testState.simulatedTime = new Date(2026, 5, 20, 10, 0, 0).getTime();

(() => {
    const { tx: tx1 } = addTransactionTest(300, 'ของที่ 1');
    const { tx: tx2 } = addTransactionTest(100, 'ของที่ 2');

    let usedDay = getGovSubsidyUsedToday(getCurrentDate());
    assertEqual('หลังบันทึก 2 รายการ ใช้สิทธิวัน = 200 บ. (ชนเพดาน)', usedDay, 200);

    // ลบรายการที่ 2
    testState.transactions = testState.transactions.filter(t => t.id !== tx2.id);
    usedDay = getGovSubsidyUsedToday(getCurrentDate());
    assertEqual('หลังลบรายการ 2 → ใช้สิทธิวัน = 180 บ. (300 ×60% = 180)', usedDay, 180);

    // ตอนนี้มีโควตาเหลือ 20 บ.
    const r3 = calculateCopay(50);
    assertEqual('คำนวณ 50 บ. → รัฐช่วยได้ 20 บ. (เพดานเหลือ 20)', r3.govSubsidy, 20);
    assertEqual('คำนวณ 50 บ. → จ่ายเอง 30 บ.', r3.userPay, 30);
    assert('isDailyCapped = true', r3.isDailyCapped);
})();

// --- TC-10: เพดานรายเดือนชนก่อนเพดานรายวัน ---
section('TC-10: เพดานรายเดือนชนก่อนเพดานรายวัน');
resetState();

(() => {
    // วันที่ 1-4: ใช้วันละ 200 บ. = สะสม 800 บ./เดือน
    for (let day = 1; day <= 4; day++) {
        testState.simulatedTime = new Date(2026, 7, day, 10, 0, 0).getTime();
        addTransactionTest(400, `วัน ${day}`);
    }

    const usedMonth = getGovSubsidyUsedThisMonth(new Date(2026, 7, 5));
    assertEqual('หลัง 4 วัน ใช้สิทธิเดือน = 800 บ.', usedMonth, 800);

    // วันที่ 5: เหลือโควตาเดือน 200 บ., โควตาวัน 200 บ. (เท่ากัน)
    testState.simulatedTime = new Date(2026, 7, 5, 10, 0, 0).getTime();
    const r5 = calculateCopay(100);
    assertEqual('วัน 5 (100 บ.) → รัฐช่วย 60 บ. (ยังไม่ชนเพดานใด)', r5.govSubsidy, 60);

    // บันทึกรายการ 400 บ. → ปกติรัฐช่วย 200 (ชนเพดานวัน) แต่เดือนเหลือ 200 ก็ยังพอ
    addTransactionTest(400, 'วัน 5 ร1');
    // ตอนนี้สะสมเดือน = 1000 บ.

    const usedMonthAfter = getGovSubsidyUsedThisMonth(new Date(2026, 7, 5));
    assertEqual('หลังวัน 5 ร1 สะสมเดือน = 1,000 บ. (เต็ม)', usedMonthAfter, 1000);

    // วันที่ 6: โควตาวันเหลือ 200 แต่โควตาเดือนหมด
    testState.simulatedTime = new Date(2026, 7, 6, 10, 0, 0).getTime();
    const r6 = calculateCopay(100);
    assertEqual('วัน 6 (100 บ.) → รัฐช่วย 0 (โควตาเดือนหมด)', r6.govSubsidy, 0);
    assert('วัน 6 → isMonthlyCapped = true', r6.isMonthlyCapped);
})();

// --- TC-11: safeEvaluate — เครื่องคิดเลขย่อย ---
section('TC-11: safeEvaluate — เครื่องคิดเลขย่อย');

(() => {
    assertEqual('50+120+45 = 215', safeEvaluate('50+120+45'), 215);
    assertEqual('100*3 = 300', safeEvaluate('100*3'), 300);
    assertEqual('500/2 = 250', safeEvaluate('500/2'), 250);
    assertEqual('100-30 = 70', safeEvaluate('100-30'), 70);
    assertEqual('(100+50)*2 = 300', safeEvaluate('(100+50)*2'), 300);
    assertEqual('99.99+0.01 = 100', safeEvaluate('99.99+0.01'), 100);
    assertEqual('10.5+20.3+5.2 = 36', safeEvaluate('10.5+20.3+5.2'), 36);

    // Edge cases
    assertEqual('empty string → 0', safeEvaluate(''), 0);
    assertEqual('null → 0', safeEvaluate(null), 0);
    assertEqual('undefined → 0', safeEvaluate(undefined), 0);
    assertEqual('just a number "42" → 42', safeEvaluate('42'), 42);

    // Security: reject dangerous input
    assertEqual('alert() → null (blocked)', safeEvaluate('alert()'), null);
    assertEqual('document.cookie → null (blocked)', safeEvaluate('document.cookie'), null);
    assertEqual('eval("1") → null (blocked)', safeEvaluate('eval("1")'), null);
    assertEqual('__proto__ → null (blocked)', safeEvaluate('__proto__'), null);

    // Malformed expressions
    assertEqual('++ → null', safeEvaluate('++'), null);
    assertEqual('/ → null', safeEvaluate('/'), null);
    assertEqual('1/0 → null (Infinity)', safeEvaluate('1/0'), null);
})();

// --- TC-12: escapeHtml — ป้องกัน XSS ---
section('TC-12: escapeHtml — ป้องกัน XSS');

(() => {
    assertEqual('plain text ไม่เปลี่ยน', escapeHtml('ร้านอาหาร'), 'ร้านอาหาร');
    assertEqual('< → &lt;', escapeHtml('<script>'), '&lt;script&gt;');
    assertEqual('" → &quot;', escapeHtml('test"value'), 'test&quot;value');
    assertEqual("' → &#039;", escapeHtml("test'value"), "test&#039;value");
    assertEqual('& → &amp;', escapeHtml('A&B'), 'A&amp;B');
    assertEqual('combined XSS', escapeHtml('<img onerror="alert(1)">'),
        '&lt;img onerror=&quot;alert(1)&quot;&gt;');
})();

// --- TC-13: isSameDay / isSameMonth accuracy ---
section('TC-13: isSameDay / isSameMonth edge cases');

(() => {
    const d1 = new Date(2026, 0, 1, 0, 0, 0);    // 1 ม.ค. 00:00
    const d2 = new Date(2026, 0, 1, 23, 59, 59);  // 1 ม.ค. 23:59
    assert('เที่ยงคืน vs 23:59 = same day', isSameDay(d1, d2));

    const d3 = new Date(2026, 0, 1, 23, 59, 59);  // 1 ม.ค.
    const d4 = new Date(2026, 0, 2, 0, 0, 0);     // 2 ม.ค.
    assert('23:59 vs 00:00 next day = NOT same day', !isSameDay(d3, d4));

    const d5 = new Date(2026, 11, 31);  // 31 ธ.ค.
    const d6 = new Date(2027, 0, 1);    // 1 ม.ค. ปีหน้า
    assert('31 ธ.ค. vs 1 ม.ค. = NOT same month', !isSameMonth(d5, d6));

    const d7 = new Date(2026, 5, 1);
    const d8 = new Date(2026, 5, 30);
    assert('1 มิ.ย. vs 30 มิ.ย. = same month', isSameMonth(d7, d8));
})();

// --- TC-14: Integrity Check - govSubsidy + userPay === amount (ทุกกรณี) ---
section('TC-14: Integrity — govSubsidy + userPay === purchaseAmount');
resetState();

(() => {
    const amounts = [1, 10, 50, 99.99, 100, 200, 333.33, 333.34, 400, 500, 999, 1000, 5000, 0.01, 0.50];
    amounts.forEach(amt => {
        const r = calculateCopay(amt);
        const sum = Math.round((r.govSubsidy + r.userPay) * 100) / 100;
        assertApprox(`${amt} บ. → govSubsidy(${r.govSubsidy}) + userPay(${r.userPay}) = ${amt}`, sum, amt, 0.02);
    });
})();

// --- TC-15: สถานะ isDailyCapped ถูกต้อง ---
section('TC-15: สถานะ isDailyCapped ถูกต้อง');
resetState();

(() => {
    // ยอดที่ 60% < 200 → ไม่ชนเพดาน
    const r1 = calculateCopay(333);  // 60% = 199.80 < 200
    assert('333 บ. (60%=199.80) → isDailyCapped = false', !r1.isDailyCapped);

    // ยอดที่ 60% > 200 → ชนเพดาน
    const r2 = calculateCopay(334);  // 60% = 200.40 > 200
    assert('334 บ. (60%=200.40) → isDailyCapped = true', r2.isDailyCapped);
    assertEqual('334 บ. → รัฐช่วย 200 บ.', r2.govSubsidy, 200);
    assertEqual('334 บ. → จ่ายเอง 134 บ.', r2.userPay, 134);
})();

// --- TC-16: สถานะ isMonthlyCapped ในกรณีโควตาเหลือบางส่วน ---
section('TC-16: สถานะ isMonthlyCapped ในกรณีโควตาเหลือบางส่วน');
resetState();

(() => {
    // สร้างสถานการณ์: ใช้โควตาเดือนไป 950 บ. (4 วัน x 200 + 1 วัน x 150)
    for (let day = 1; day <= 4; day++) {
        testState.simulatedTime = new Date(2026, 8, day, 10, 0, 0).getTime();
        addTransactionTest(400, `วัน ${day}`);
    }
    testState.simulatedTime = new Date(2026, 8, 5, 10, 0, 0).getTime();
    addTransactionTest(250, 'วัน 5'); // 250 * 0.6 = 150

    const usedMonth = getGovSubsidyUsedThisMonth(new Date(2026, 8, 6));
    assertEqual('ใช้สิทธิเดือนแล้ว = 950 บ.', usedMonth, 950);

    // วันที่ 6: โควตาเดือนเหลือ 50 บ., โควตาวันเหลือ 200 บ.
    testState.simulatedTime = new Date(2026, 8, 6, 10, 0, 0).getTime();
    const r1 = calculateCopay(100); // ปกติรัฐช่วย 60 แต่เดือนเหลือ 50
    assertEqual('วัน 6 (100 บ.) → รัฐช่วย 50 บ. (โควตาเดือนเหลือ 50)', r1.govSubsidy, 50);
    assertEqual('วัน 6 → จ่ายเอง 50 บ.', r1.userPay, 50);
    assert('วัน 6 → isMonthlyCapped = true', r1.isMonthlyCapped);
    assert('วัน 6 → isDailyCapped = false (ยังเหลือวัน)', !r1.isDailyCapped);
})();


// ============================================================
// ส่วนที่ 4: สรุปผล
// ============================================================

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 สรุปผลการทดสอบ QA`);
console.log(`${'='.repeat(60)}`);
console.log(`   Total Tests:  ${totalTests}`);
console.log(`   ✅ Passed:     ${passedTests}`);
console.log(`   ❌ Failed:     ${failedTests}`);
console.log(`   Pass Rate:    ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('   รายการที่ FAIL:');
    failedDetails.forEach(d => console.log(d));
    console.log(`${'─'.repeat(60)}`);
    process.exit(1);
} else {
    console.log(`\n   🎉 ทุกกรณีทดสอบผ่านหมด! (All tests passed)`);
    process.exit(0);
}
