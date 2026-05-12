const fs = require('fs');

function fixConflict(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');
    const pattern = /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> [a-f0-9]+\r?\n?/g;
    content = content.replace(pattern, '$1\r\n');
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log('Fixed ' + filepath);
}

['app/admin/layout.tsx', 'app/reports/page.tsx', 'app/dashboard/cashier/page.tsx'].forEach(fixConflict);
