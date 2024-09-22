const fs = require('fs');
const path = require('path');


const argv = process.argv;
const args = checkArray(argv[2].split(';'));

// const args = '于吉,左小慈,张角;null;统帅,速度'.split(';');
// const args = '小号-关羽,小号-关妹,小号-张飞;null;速度'.split(';');

args[0] = args[0].split(',');
args[1] = args[1] && args[1] !== 'null' ? args[1].split(',') : null;
args[2] = args[2] && args[2] !== 'null' ? args[2].split(',') : null;
args.forEach(arr => {
    arr && checkArray(arr);
});

main(args[0], args[2], args[1]);

function main(names, attrs, levels) {
    attrs = attrs || ['武力', '智力', '统帅', '速度'];
    levels = levels || [5, 9, 10, 19, 20, 29, 30, 39, 40, 49, 50];

    levels.forEach((v, i) => {
        levels[i] = +v;
    });

    const l = checkNameLen(names);
    const k = checkKingdoms(names);
    levels.forEach(lv => {
        console.log(`等级: ${lv}`);
        names.forEach(name => {
            let strs = [];
            attrs.forEach(attr => {
                strs.push(`${make(name, lv, l, attr, k)}`);
            });
            console.log(`> ${toFixed(name, 0, l, 'l', true)} { ${strs.join(', ')} }`);
        });
    });
}

function checkNameLen(names) {
    let l = 0;
    names.forEach(name => {
        if (l < name.length) {
            l = name.length;
        }
    });
    return l;
}

/**
 * 判断是否属于同一个阵营
 */
function checkKingdoms(names) {
    let k = '未指定';
    names.forEach(name => {
        const p = path.join(__dirname, name + '.json');
        const str = fs.readFileSync(p).toString('utf8');
        const json = JSON.parse(str);
        if (k === '未指定') {
            k = json['阵营'];
        }
        else if (k && k !== json['阵营']) {
            k = null;
        }
    });
    return k !== null && k !== '未指定';
}

/**
 * 输出武将的某个属性
 * @param {*} name 名字
 * @param {*} lv 等级
 * @param {*} l 队伍中最长的名字长度（用于格式化文本）
 * @param {*} attr 输出的属性
 * @param {*} kingdom 阵营是否生效
 */
function make(name, lv, l, attr, kingdom) {
    const tech = JSON.parse(fs.readFileSync(path.join(__dirname, '配置.json')).toString('utf-8'))['科技'];

    const str = fs.readFileSync(path.join(__dirname, name + '.json')).toString('utf8').replace(/，/g, ',');
    const json = JSON.parse(str);

    let base = json['基础'][attr] + json['成长'][attr] * (lv - 1);

    const keys = Object.keys(json['加点']);
    keys.forEach(key => {
        const k = +key;
        if (k <= lv) {
            base += json['加点'][key][attr];
        }
    });

    if (lv >= 20) {
        const equip = json['装备'];
        for (const key in equip) {
            const item = equip[key];
            base += item[attr] || 0;
        }
    }

    let rate = 1;
    switch (json['品质']) {
        case 'S':
            rate = 1.2;
            break;
        case 'B':
            rate = 0.85;
            break;
        case 'C':
            rate = 0.7;
            break;
    }
    let num = base * rate;

    let add = 0;
    if (json['仙人'] === '是') {
        add += 0.3;
    }
    if (kingdom) {
        add += tech['协力'][json['阵营']] / 100;
    }
    num += base * add;

    const map = { "武力": "武", "智力": "谋", "统帅": "防", "速度": "速" };
    num += tech['兵战'][map[attr]] * 2;

    num += checkOther('缘份', json, attr);

    if (lv >= 20) {
        const equip = json['装备'];
        for (const key in equip) {
            const item = equip[key];
            item['特技'] && typeof item['特技'] === 'string' && item['特技'].length > 0 && item['特技'].split(',').forEach(spec => {
                num += special(spec, attr);
            })
        }
    }

    if (lv >= 30) {
        num += checkOther('兵书', json, attr);
    }
    num += checkOther('战法', json, attr);

    return `${attr}:${toFixed(base, 2, 6, 'r')} -> ${toFixed(num, 2, 6)}`;
}

function checkOther(name, json, attr) {
    const strs = json[name] || '';
    const other = JSON.parse(fs.readFileSync(path.join(__dirname, '配置.json')).toString('utf-8'))[name];

    let plus = 0;

    for (const key in other) {
        if (strs.indexOf(key) > -1) {
            const item = other[key];
            for (const k in item) {
                if (k === attr) {
                    plus += item[k];
                }
            }
        }
    }

    return plus;
}

/**
 * 对浮点数进行取整
 * @param {*} v 原始值
 * @param {*} n 小数保留位数
 * @param {*} l 返回值输出长度，若输出时长度小于此值，则在左侧补空
 * @param {*} lr 为 `r` 时补空右边，否则补空左边
 * @param {*} cn 是否为中文，补全一个中文字符需要两个空格
 * @returns 
 */
function toFixed(v, n, l, lr, cn) {
    let str = v.toString();
    if (str.indexOf('.') === -1 && n > 0 && !cn) {
        str += '.';
    }

    while (n > 0) {
        n--;
        str += '0';
    }

    const index = str.indexOf('.');
    if (index > -1) {
        str = str.substring(0, index + 3);
    }

    while (str.length < l) {
        if (lr === 'r') {
            if (cn) {
                str = '  ' + str;
            }
            else {
                str = ' ' + str;
            }
        }
        else {
            if (cn) {
                str = str + '  ';
            }
            else {
                str = str + ' ';
            }
        }
    }

    return str;
}

/**
 * 发动特技获取属性点
 */
function special(name, attr) {
    const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '配置.json')).toString('utf-8'))['特技'][name];

    if (!spec) {
        console.error(`忽略${name}对${attr}的加成`);
        return;
    }

    return spec[attr] || 0;
}

function checkArray(arr) {
    for (let i = arr.length - 1; i > -1; i--) {
        if (arr[i]) {
            continue;
        }
        arr.splice(i, 1);
    }
    return arr;
}

function trim(str) {
    while (str.length > 0) {
        const chr = str.chatAt(0);
        if (chr === ' ' || chr === ' ' || chr === '\t') {
            str = str.substring(1);
        }
        else {
            break;
        }
    }
    while (str.length > 0) {
        const chr = str.chatAt(str.length - 1);
        if (chr === ' ' || chr === ' ' || chr === '\t') {
            str = str.substring(0, str.length - 1);
        }
        else {
            break;
        }
    }
    return str;
}
