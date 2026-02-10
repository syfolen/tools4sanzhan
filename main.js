const fs = require('fs');
const path = require('path');

const Logger = function () {
    this.logErr = true;
    this.logWarn = false;
};
Logger.prototype.info = function () {
    console.info.apply(null, [].slice.call(arguments));
};
Logger.prototype.warn = function () {
    this.logWarn && console.info.apply(null, [].slice.call(arguments));
};
Logger.prototype.error = function () {
    this.logErr && console.info.apply(null, [].slice.call(arguments));
};

const ATTRS = ['武力', '智力', '统帅', '速度'];
const LEVELS = [5, 9, 10, 19, 20, 29, 30, 39, 40, 49, 50];

const logger = new Logger();

let configs = null;
let userTechs = null;

const init = function () {
    // const argv = process.argv;
    // const argv = 'node main.js 落晚霞 枪 SP诸葛亮,张苞,关兴'.split(' ');
    // const argv = 'node main.js 落晚霞 枪 张飞,关银屏,黄月英'.split(' ');
    // const argv = 'node main.js 阿彩 骑 SP荀彧,SP郭嘉,贾诩'.split(' ');
    // const argv = 'node main.js 阿彩 骑 貂蝉,左慈,张角'.split(' ');
    const argv = 'node main.js 落晚霞 弓 貂蝉,左慈,张角'.split(' ');
    logger.info(argv);

    const user = argv[2];
    const army = argv[3];
    const args = [].slice.call(argv, 4);

    args.forEach((s, i) => {
        args[i] = s && s !== 'null' ? s.split(',') : null;
    });
    logger.info(`${user} ${army} ${args[0]}`);

    main(user, army, args[0], args[2], args[1]);
};

const main = function (user, army, names, attrs, levels) {
    attrs = attrs || ATTRS;
    levels = levels || LEVELS;

    levels.forEach((v, i) => {
        levels[i] = +v;
    });

    configs = JSON.parse(fs.readFileSync(path.join(__dirname, '配置.json')).toString('utf-8').replace(/，/g, ','));
    userTechs = JSON.parse(fs.readFileSync(path.join(__dirname, '科技', user + '.json')).toString('utf-8').replace(/，/g, ','));

    const heros = initHeros(user, names);
    const faction = initFactions(heros);
    const maxNameLen = getMaxLenOfStrs(names);

    // debugger
    levels.forEach(lv => {
        logger.info(`等级: ${lv}`);
        for (const name in heros) {
            let strs = [];
            attrs.forEach(attr => {
                strs.push(`${make(heros[name], army, lv, attr, faction)}`);
            });
            logger.info(`> ${toFixed(name, 0, maxNameLen, 'l', true)} { ${strs.join(', ')} }`);
        }
    });
};

const make = function (hero, army, lv, attr, faction) {
    let base = hero['基础'][attr] + hero['成长'][attr] * (lv - 1);

    const keys = Object.keys(hero['加点']);
    keys.forEach(key => {
        if (key <= lv) {
            base += hero['加点'][key][attr];
        }
    });

    if (lv >= 20) {
        const equips = hero['装备'];
        for (const key in equips) {
            const item = equips[key];
            base += item[attr] || 0;
        }
    }

    let rate = 1;
    switch (hero['品质'][army]) {
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
    if (hero['标签'] && hero['标签'].indexOf('仙人') > -1) {
        add += 0.3;
    }
    if (faction) {
        add += userTechs['协力'][hero['阵营']] / 100;
    }
    num += base * add;

    const map = { "武力": "武", "智力": "谋", "统帅": "防", "速度": "速" };
    num += userTechs['兵战'][map[attr]] * 2;

    num += checkOther('缘份', hero, attr);

    if (lv >= 20) {
        const equips = hero['装备'];
        for (const key in equips) {
            const item = equips[key];
            item['特技'] && item['特技'].length > 0 && item['特技'].split(',').forEach(spec => {
                const reg0 = checkSpec(spec, attr);
                if (isNaN(reg0)) {
                    debugger;
                }
                num += checkSpec(spec, attr);
            });
        }
    }

    if (lv >= 30) {
        num += checkOther('兵书', hero, attr);
    }
    num += checkOther('战法', hero, attr);

    const s1 = toFixed(base, 2, 6, 'r');
    const s2 = toFixed(num, 1, 6);
    if (isNaN(s1) || isNaN(s2)) {
        debugger;
    }
    return `${attr}:${toFixed(base, 2, 6, 'r')} -> ${toFixed(num, 2, 6)}`;
};

const toFixed = function (v, decimals, digits, lr, cn) {
    let str = v.toString();
    if (str.indexOf('.') === -1 && decimals > 0 && !cn) {
        str += '.';
    }

    while (decimals > 0) {
        decimals--;
        str += '0';
    }

    const index = str.indexOf('.');
    if (index > -1) {
        str = str.substring(0, index + 3);
    }

    while (getStrLen(str) < digits) {
        if (lr === 'r') {
            str = ' ' + str;
        }
        else {
            str = str + ' ';
        }
    }

    return str;
};

const checkSpec = function (name, attr) {
    const spec = configs['特技'][name];
    if (!spec) {
        logger.warn(`忽略${name}对${attr}的加成`);
        return;
    }

    return spec[attr] || 0;
};

const checkOther = function (type, hero, attr) {
    const strs = hero[type] || '';
    const other = configs[type];

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

const getMaxLenOfStrs = function (strs) {
    strs.sort((a, b) => {
        return getStrLen(b) - getStrLen(a);
    });
    return getStrLen(strs[0]);
};

const getStrLen = function (str) {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) < 128) {
            len++;
        }
        else {
            len += 2;
        }
    }
    return len;
};

const initFactions = function (heros) {
    const factions = [];

    for (const key in heros) {
        const hero = heros[key];
        if (factions.indexOf(hero['阵营']) === -1) {
            factions.push(hero['阵营']);
        }
    }

    if (factions.length === 1) {
        return factions[0];
    }
    else {
        return null;
    }
};

const initHeros = function (user, names) {
    const heros = {};
    const heroConfigs = JSON.parse(fs.readFileSync(path.join(__dirname, '武将.json')).toString('utf-8'));

    // debugger
    names.forEach(name => {
        const hero = JSON.parse(fs.readFileSync(path.join(__dirname, user, name + '.json')).toString('utf-8'));
        const index = name.indexOf('-');

        let fac = null;
        let alias = name;
        if (index > -1) {
            fac = name.substring(index + 1);
            name = name.substring(0, index);
        }

        let heroTemp = null;
        for (const faction in heroConfigs) {
            for (const prefix in heroConfigs[faction]) {
                for (const key in heroConfigs[faction][prefix]) {
                    if (key === name) {
                        heroTemp = heroConfigs[faction][prefix][key];
                        break;
                    }
                }
                if (heroTemp) {
                    break;
                }
            }

            if (heroTemp) {
                if (fac) {
                    hero['阵营'] = fac;
                }
                else {
                    hero['阵营'] = faction;
                }
                break;
            }
        }
        merge(hero, heroTemp);

        heros[alias] = hero;
    });

    return heros;
};

const merge = function (dst, src) {
    for (const key in src) {
        if (dst.hasOwnProperty(key)) {
            continue;
        }
        dst[key] = src[key];
    }
};

init();
