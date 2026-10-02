function openTab(tabId, btnElement) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

function toggleDimensionInputs() {
    const pattern = document.getElementById('patternSelect').value;
    document.getElementById('group_b').style.display = (pattern === 'circle' || pattern === 'single') ? 'none' : 'grid';
    document.getElementById('group_d').style.display = (pattern === 'circle') ? 'none' : 'grid';
    document.getElementById('group_D').style.display = (pattern === 'circle') ? 'grid' : 'none';
}

function calculateWeld() {
    const pattern = document.getElementById('patternSelect').value;
    const h = parseFloat(document.getElementById('weld_h').value) || 0.1;
    const b = parseFloat(document.getElementById('dim_b').value) || 0;
    const d = parseFloat(document.getElementById('dim_d').value) || 0;
    const D = parseFloat(document.getElementById('dim_D').value) || 0;

    const Fx = parseFloat(document.getElementById('Fx').value) || 0;
    const Fy = parseFloat(document.getElementById('Fy').value) || 0;
    const Fz = parseFloat(document.getElementById('Fz').value) || 0;

    const xp = parseFloat(document.getElementById('xp').value) || 0;
    const yp = parseFloat(document.getElementById('yp').value) || 0;
    const zp = parseFloat(document.getElementById('zp').value) || 0;

    const Mx_ext = parseFloat(document.getElementById('Mx_ext').value) || 0;
    const My_ext = parseFloat(document.getElementById('My_ext').value) || 0;
    const Mz_ext = parseFloat(document.getElementById('Mz_ext').value) || 0;
    const Sut = parseFloat(document.getElementById('Sut').value) || 1;

    const customX = parseFloat(document.getElementById('custom_x').value);
    const customY = parseFloat(document.getElementById('custom_y').value);

    const t = 0.7071 * h;

    let Au = 0, xbar = 0, ybar = 0, Iux = 0, Iuy = 0, Ju = 0;
    let points = [];
    let segments = [];

    // Line weld geometry formulas (Shigley Tables 9-1 & 9-2)
    if (pattern === 'single') {
        Au = d; xbar = 0; ybar = d / 2;
        Iux = Math.pow(d, 3) / 12; Iuy = 0; Ju = Iux;
        points = [{name: 'Bottom', x: 0, y: 0}, {name: 'Top', x: 0, y: d}];
        segments = [{x1: 0, y1: 0, x2: 0, y2: d}];
    } else if (pattern === 'two_vert') {
        Au = 2 * d; xbar = b / 2; ybar = d / 2;
        Iux = Math.pow(d, 3) / 6; Iuy = (Math.pow(b, 2) * d) / 2; Ju = Iux + Iuy;
        points = [{name: 'BL', x: 0, y: 0}, {name: 'TL', x: 0, y: d}, {name: 'BR', x: b, y: 0}, {name: 'TR', x: b, y: d}];
        segments = [{x1: 0, y1: 0, x2: 0, y2: d}, {x1: b, y1: 0, x2: b, y2: d}];
    } else if (pattern === 'two_horiz') {
        Au = 2 * b; xbar = b / 2; ybar = d / 2;
        Iux = (b * Math.pow(d, 2)) / 2; Iuy = Math.pow(b, 3) / 6; Ju = Iux + Iuy;
        points = [{name: 'BL', x: 0, y: 0}, {name: 'BR', x: b, y: 0}, {name: 'TL', x: 0, y: d}, {name: 'TR', x: b, y: d}];
        segments = [{x1: 0, y1: 0, x2: b, y2: 0}, {x1: 0, y1: d, x2: b, y2: d}];
    } else if (pattern === 'l_shape') {
        Au = b + d; xbar = Math.pow(b, 2) / (2 * (b + d)); ybar = Math.pow(d, 2) / (2 * (b + d));
        Iux = (Math.pow(d, 3) * (4*b + d)) / (12 * (b + d));
        Iuy = (Math.pow(b, 3) * (4*d + b)) / (12 * (b + d)); Ju = Iux + Iuy;
        points = [{name: 'Corner', x: 0, y: 0}, {name: 'Horiz End', x: b, y: 0}, {name: 'Vert End', x: 0, y: d}];
        segments = [{x1: 0, y1: d, x2: 0, y2: 0}, {x1: 0, y1: 0, x2: b, y2: 0}];
    } else if (pattern === 'u_shape') {
        Au = 2 * b + d; xbar = Math.pow(b, 2) / (2 * b + d); ybar = d / 2;
        Iux = (Math.pow(d, 2) * (6 * b + d)) / 12;
        Iuy = (2 * Math.pow(b, 3) / 3) - (Math.pow(b, 4) / (2 * b + d)); Ju = Iux + Iuy;
        points = [{name: 'BL', x: 0, y: 0}, {name: 'TL', x: 0, y: d}, {name: 'BR', x: b, y: 0}, {name: 'TR', x: b, y: d}];
        segments = [{x1: 0, y1: d, x2: 0, y2: 0}, {x1: 0, y1: 0, x2: b, y2: 0}, {x1: b, y1: 0, x2: b, y2: d}];
    } else if (pattern === 'rect') {
        Au = 2 * b + 2 * d; xbar = b / 2; ybar = d / 2;
        Iux = (Math.pow(d, 2) * (3 * b + d)) / 6; Iuy = (Math.pow(b, 2) * (3 * d + b)) / 6; Ju = Iux + Iuy;
        points = [{name: 'BL', x: 0, y: 0}, {name: 'BR', x: b, y: 0}, {name: 'TL', x: 0, y: d}, {name: 'TR', x: b, y: d}];
        segments = [
            {x1: 0, y1: 0, x2: b, y2: 0}, {x1: b, y1: 0, x2: b, y2: d},
            {x1: b, y1: d, x2: 0, y2: d}, {x1: 0, y1: d, x2: 0, y2: 0}
        ];
    } else if (pattern === 'circle') {
        Au = Math.PI * D; xbar = D / 2; ybar = D / 2;
        Iux = (Math.PI * Math.pow(D, 3)) / 8; Iuy = Iux; Ju = (Math.PI * Math.pow(D, 3)) / 4;
        points = [{name: 'Bottom', x: D/2, y: 0}, {name: 'Top', x: D/2, y: D}, {name: 'Left', x: 0, y: D/2}, {name: 'Right', x: D, y: D/2}];
    } else if (pattern === 't_shape') {
        Au = b + d; xbar = b / 2; ybar = (Math.pow(d, 2) + 2*b*d) / (2 * (b + d));
        Iux = (Math.pow(d, 3) * (4*b + d)) / (12 * (b + d)); Iuy = Math.pow(b, 3) / 12; Ju = Iux + Iuy;
        points = [{name: 'TL', x: 0, y: d}, {name: 'TR', x: b, y: d}, {name: 'Bottom', x: b/2, y: 0}];
        segments = [{x1: 0, y1: d, x2: b, y2: d}, {x1: b/2, y1: 0, x2: b/2, y2: d}];
    }

    if (!isNaN(customX) && !isNaN(customY) && (customX !== 0 || customY !== 0)) {
        points.push({name: 'Custom', x: customX, y: customY});
    }

    const A = t * Au;
    const Ix = t * Iux;
    const Iy = t * Iuy;
    const J = t * Ju;

    document.getElementById('res_Au').innerText = Au.toFixed(3);
    document.getElementById('res_A').innerText = A.toFixed(3);
    document.getElementById('res_centroid').innerText = `(${xbar.toFixed(3)}, ${ybar.toFixed(3)})`;
    document.getElementById('res_Iux').innerText = Iux.toFixed(3);
    document.getElementById('res_Ix').innerText = Ix.toFixed(3);
    document.getElementById('res_Iuy').innerText = Iuy.toFixed(3);
    document.getElementById('res_Iy').innerText = Iy.toFixed(3);
    document.getElementById('res_Ju').innerText = Ju.toFixed(3);
    document.getElementById('res_J').innerText = J.toFixed(3);

    const rx = xp - xbar;
    const ry = yp - ybar;
    const rz = zp;

    const Mx_calc = Mx_ext + (ry * Fz) - (rz * Fy);
    const My_calc = My_ext + (rz * Fx) - (rx * Fz);
    const Mz_calc = Mz_ext + (rx * Fy) - (ry * Fx);

    document.getElementById('moment_breakdown').innerHTML = `
        <strong>Mx (Bending about X):</strong> ${Mx_calc.toFixed(1)} <br>
        <strong>My (Bending about Y):</strong> ${My_calc.toFixed(1)} <br>
        <strong>Mz (Torsion about Z):</strong> ${Mz_calc.toFixed(1)}
    `;

    const tau_prime_x = Fx / A;
    const tau_prime_y = Fy / A;
    const tau_prime_z = Fz / A;

    let tableHtml = '';
    let maxTau = -1;
    let maxPtName = '';

    const results = points.map(pt => {
        const dx = pt.x - xbar;
        const dy = pt.y - ybar;

        const tau_double_tx = - (Mz_calc * dy) / J;
        const tau_double_ty = (Mz_calc * dx) / J;

        const tau_double_bz = (Ix > 0 ? (Mx_calc * dy) / Ix : 0) - (Iy > 0 ? (My_calc * dx) / Iy : 0);

        const tau_x = tau_prime_x + tau_double_tx;
        const tau_y = tau_prime_y + tau_double_ty;
        const tau_z = tau_prime_z + tau_double_bz;

        const tau_total = Math.sqrt(tau_x * tau_x + tau_y * tau_y + tau_z * tau_z);

        if (tau_total > maxTau) {
            maxTau = tau_total;
            maxPtName = pt.name;
        }

        return {
            name: pt.name,
            x: pt.x,
            y: pt.y,
            tau_prime_x,
            tau_prime_y,
            tau_prime_z,
            tau_double_tx,
            tau_double_ty,
            tau_double_bz,
            tau_x,
            tau_y,
            tau_z,
            tau_total
        };
    });

    results.forEach(res => {
        const isMax = Math.abs(res.tau_total - maxTau) < 1e-5;
        tableHtml += `<tr class="${isMax ? 'highlight-row' : ''}">
            <td>${res.name} ${isMax ? '★' : ''}</td>
            <td>(${res.x.toFixed(2)}, ${res.y.toFixed(2)})</td>
            <td>${res.tau_prime_x.toFixed(1)}</td>
            <td>${res.tau_prime_y.toFixed(1)}</td>
            <td>${res.tau_prime_z.toFixed(1)}</td>
            <td>${res.tau_double_tx.toFixed(1)}</td>
            <td>${res.tau_double_ty.toFixed(1)}</td>
            <td>${res.tau_double_bz.toFixed(1)}</td>
            <td>${res.tau_x.toFixed(1)}</td>
            <td>${res.tau_y.toFixed(1)}</td>
            <td>${res.tau_z.toFixed(1)}</td>
            <td><strong>${res.tau_total.toFixed(1)}</strong></td>
        </tr>`;
    });

    document.querySelector('#stressTable tbody').innerHTML = tableHtml;

    const tau_allow = 0.30 * Sut;
    const FOS = tau_allow / maxTau;
    const pass = FOS >= 1.0;

    document.getElementById('safety_summary').innerHTML = `
        <strong>Maximum Shear Stress (τmax):</strong> ${maxTau.toFixed(1)} <br>
        <strong>Critical Point:</strong> ${maxPtName} <br>
        <strong>Allowable Weld Shear (0.30 · Sut):</strong> ${tau_allow.toFixed(1)} <br>
        <strong>Factor of Safety (n):</strong> <span class="${pass ? 'badge-pass' : 'badge-fail'}">${FOS.toFixed(2)}</span> (${pass ? 'SAFE' : 'UNSAFE'})
    `;

    drawDiagram(pattern, b, d, D, xbar, ybar, xp, yp, Fx, Fy, Fz, points, maxPtName);
}

function drawDiagram(pattern, b, d, D, xbar, ybar, xp, yp, Fx, Fy, Fz, points, maxPtName) {
    const canvas = document.getElementById('weldCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let minX = Math.min(0, xp, xbar);
    let maxX = Math.max(pattern === 'circle' ? D : (b || 1), xp, xbar);
    let minY = Math.min(0, yp, ybar);
    let maxY = Math.max(pattern === 'circle' ? D : (d || 1), yp, ybar);

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    minX -= spanX * 0.25; maxX += spanX * 0.25;
    minY -= spanY * 0.25; maxY += spanY * 0.25;

    const pad = 35;
    const drawW = canvas.width - 2 * pad;
    const drawH = canvas.height - 2 * pad;

    const scale = Math.min(drawW / (maxX - minX), drawH / (maxY - minY));

    function toCanvas(x, y) {
        return {
            cx: pad + (x - minX) * scale,
            cy: canvas.height - (pad + (y - minY) * scale)
        };
    }

    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;

    const origin = toCanvas(0, 0);
    ctx.strokeStyle = '#ced4da';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(origin.cx, 0); ctx.lineTo(origin.cx, canvas.height);
    ctx.moveTo(0, origin.cy); ctx.lineTo(canvas.width, origin.cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    if (pattern === 'circle') {
        const center = toCanvas(D/2, D/2);
        ctx.beginPath();
        ctx.arc(center.cx, center.cy, (D/2) * scale, 0, 2 * Math.PI);
        ctx.stroke();
    } else {
        let segments = [];
        if (pattern === 'single') segments = [{x1: 0, y1: 0, x2: 0, y2: d}];
        else if (pattern === 'two_vert') segments = [{x1: 0, y1: 0, x2: 0, y2: d}, {x1: b, y1: 0, x2: b, y2: d}];
        else if (pattern === 'two_horiz') segments = [{x1: 0, y1: 0, x2: b, y2: 0}, {x1: 0, y1: d, x2: b, y2: d}];
        else if (pattern === 'l_shape') segments = [{x1: 0, y1: d, x2: 0, y2: 0}, {x1: 0, y1: 0, x2: b, y2: 0}];
        else if (pattern === 'u_shape') segments = [{x1: 0, y1: d, x2: 0, y2: 0}, {x1: 0, y1: 0, x2: b, y2: 0}, {x1: b, y1: 0, x2: b, y2: d}];
        else if (pattern === 'rect') segments = [{x1: 0, y1: 0, x2: b, y2: 0}, {x1: b, y1: 0, x2: b, y2: d}, {x1: b, y1: d, x2: 0, y2: d}, {x1: 0, y1: d, x2: 0, y2: 0}];
        else if (pattern === 't_shape') segments = [{x1: 0, y1: d, x2: b, y2: d}, {x1: b/2, y1: 0, x2: b/2, y2: d}];

        segments.forEach(seg => {
            const p1 = toCanvas(seg.x1, seg.y1);
            const p2 = toCanvas(seg.x2, seg.y2);
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);
            ctx.stroke();
        });
    }

    const centroidPos = toCanvas(xbar, ybar);
    ctx.strokeStyle = '#d93025';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centroidPos.cx, centroidPos.cy, 6, 0, 2 * Math.PI);
    ctx.moveTo(centroidPos.cx - 10, centroidPos.cy); ctx.lineTo(centroidPos.cx + 10, centroidPos.cy);
    ctx.moveTo(centroidPos.cx, centroidPos.cy - 10); ctx.lineTo(centroidPos.cx, centroidPos.cy + 10);
    ctx.stroke();

    ctx.fillStyle = '#d93025';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`Centroid (${xbar.toFixed(1)}, ${ybar.toFixed(1)})`, centroidPos.cx + 10, centroidPos.cy - 8);

    points.forEach(pt => {
        const p = toCanvas(pt.x, pt.y);
        const isMax = pt.name === maxPtName;

        ctx.fillStyle = isMax ? '#d93025' : '#1a73e8';
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, isMax ? 6 : 4, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = isMax ? '#d93025' : '#202124';
        ctx.font = isMax ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.fillText(pt.name, p.cx + 8, p.cy + 4);
    });

    const loadPos = toCanvas(xp, yp);
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(loadPos.cx, loadPos.cy, 6, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#e67e22';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`Load (${xp}, ${yp})`, loadPos.cx + 10, loadPos.cy + 12);

    function drawArrow(fromX, fromY, toX, toY, color) {
        const headlen = 8;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.fill();
    }

    if (Math.abs(Fx) > 0) {
        const len = (Fx > 0 ? 30 : -30);
        drawArrow(loadPos.cx, loadPos.cy, loadPos.cx + len, loadPos.cy, '#e67e22');
    }
    if (Math.abs(Fy) > 0) {
        const len = (Fy > 0 ? -30 : 30);
        drawArrow(loadPos.cx, loadPos.cy, loadPos.cx, loadPos.cy + len, '#e67e22');
    }
    if (Math.abs(Fz) > 0) {
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(loadPos.cx - 12, loadPos.cy - 12, 5, 0, 2 * Math.PI);
        ctx.stroke();
        if (Fz > 0) {
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            ctx.arc(loadPos.cx - 12, loadPos.cy - 12, 2, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(loadPos.cx - 15, loadPos.cy - 15); ctx.lineTo(loadPos.cx - 9, loadPos.cy - 9);
            ctx.moveTo(loadPos.cx - 15, loadPos.cy - 9); ctx.lineTo(loadPos.cx - 9, loadPos.cy - 15);
            ctx.stroke();
        }
    }
}

// Initial calculations on page load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('patternSelect')) {
        toggleDimensionInputs();
        calculateWeld();
    }
});