/**
 * 菜品级菜单数据（按品牌建立真实菜单，价格贴近市场行情）
 *
 * 背景：无商家菜单 API，菜品为演示数据；每个品牌有自己的专属菜单
 * （菜名/价格参考该品牌实际在售品类与市场行情），价格作为比价基准价锚点，
 * 同一门店同一菜品多次进入价格一致。
 * - buildStoreMenu 从店名提取品牌名 → 查 BRAND_MENU；未命中时回退到品类池
 */
import type { CategoryCode } from '@/types/coupon';
import { hashString, mulberry32 } from './stores';

export interface Dish {
  id: string;
  name: string;
  emoji: string;
  /** 描述（口味/份量） */
  desc: string;
  /** 平台原价基准（元） */
  basePrice: number;
  /** 月售 */
  monthlySales: number;
  /** 是否招牌推荐 */
  isSignature: boolean;
  /** 菜品实物图（text_to_image 生成的美食摄影图） */
  imageUrl: string;
}

/** 生成菜品实物图 URL（基于菜名+描述生成高清美食摄影图） */
function buildDishImageUrl(name: string, desc: string): string {
  const prompt = `美食摄影，${name}，${desc}，高清实拍，诱人，自然光，干净背景，俯拍或45度角，专业美食摄影风格`;
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=square`;
}

/** 单道菜定义（菜单池用） */
interface DishDef {
  name: string;
  emoji: string;
  desc: string;
  price: number;
}

/** 品牌 → 专属菜单（菜名/价格参考品牌实际在售） */
const BRAND_MENU: Record<string, DishDef[]> = {
  // ===== 汉堡披萨 =====
  '肯德基宅急送': [
    // —— 招牌汉堡·卷 ——
    { name: '香辣鸡腿堡', emoji: '🍔', desc: '香辣鸡腿排+生菜', price: 21 },
    { name: '劲脆鸡腿堡', emoji: '🍔', desc: '原味脆鸡腿排+生菜', price: 21 },
    { name: '新奥尔良烤鸡腿堡', emoji: '🍔', desc: '整块烤鸡腿排+生菜', price: 22 },
    { name: '汁汁厚牛堡', emoji: '🍔', desc: '厚切牛肉饼+车打芝士', price: 27 },
    { name: '老北京鸡肉卷', emoji: '🌯', desc: '甜面酱+黄瓜+鸡肉', price: 19 },
    { name: '嫩牛五方', emoji: '🌯', desc: '嫩滑牛肉条+酥脆薄饼', price: 21 },
    // —— 炸鸡 ——
    { name: '吮指原味鸡 1 块', emoji: '🍗', desc: '秘制配方现炸', price: 13 },
    { name: '黄金脆皮鸡 1 块', emoji: '🍗', desc: '金黄香辣脆壳', price: 13 },
    { name: '香辣鸡翅 2 只', emoji: '🍗', desc: '经典辣翅现炸', price: 13 },
    { name: '新奥尔良烤翅 2 只', emoji: '🍗', desc: '奥尔良风味烤制', price: 14 },
    { name: '热辣香骨鸡 3 块', emoji: '🍗', desc: '带骨炸鸡热辣过瘾', price: 13 },
    { name: '劲爆鸡米花(大)', emoji: '🍗', desc: '一口一个香辣过瘾', price: 14 },
    { name: 'K萨 原味鸡', emoji: '🍕', desc: '鸡肉做底+芝士蔬菜', price: 24 },
    // —— 小食·配餐 ——
    { name: '薯条(中)', emoji: '🍟', desc: '金黄酥脆', price: 12 },
    { name: '黄金鸡块 5 块', emoji: '🍗', desc: '配蘸酱经典鸡块', price: 13 },
    { name: '葡式蛋挞 1 只', emoji: '🥧', desc: '酥皮奶香', price: 9 },
    { name: '土豆泥', emoji: '🥔', desc: '浇黑胡椒肉汁', price: 8 },
    { name: '香甜粟米棒', emoji: '🌽', desc: '软糯香甜玉米棒', price: 9 },
    { name: '红豆派', emoji: '🥟', desc: '酥皮裹红豆沙', price: 8 },
    { name: '芙蓉鲜蔬汤', emoji: '🍲', desc: '蛋花+多种鲜蔬', price: 9 },
    // —— 主食·饭 ——
    { name: '新奥尔良鸡腿饭', emoji: '🍚', desc: '烤鸡腿排+时蔬', price: 26 },
    { name: '港式烧味大鸡腿饭', emoji: '🍚', desc: '蜜汁大鸡腿+米饭', price: 28 },
    // —— 饮品·甜点 ——
    { name: '百事可乐(中)', emoji: '🥤', desc: '冰镇汽水', price: 10 },
    { name: '九珍果汁', emoji: '🧃', desc: '九种果蔬复合汁', price: 12 },
    { name: '雪顶咖啡', emoji: '☕', desc: '冰咖啡顶冰淇淋', price: 16 },
    { name: '柠檬红茶', emoji: '🍋', desc: '鲜柠片+红茶', price: 12 },
    { name: '草莓圣代', emoji: '🍦', desc: '软冰淇淋淋草莓酱', price: 11 },
    { name: '生椰拿铁', emoji: '☕', desc: 'K咖啡厚椰乳拿铁', price: 16 }
  ],
  '麦当劳': [
    { name: '巨无霸', emoji: '🍔', desc: '双层牛肉饼+芝士', price: 25 },
    { name: '麦辣鸡腿堡', emoji: '🌶️', desc: '辣味鸡腿排', price: 20 },
    { name: '麦乐鸡 5 块', emoji: '🍗', desc: '配甜酸酱', price: 15 },
    { name: '薯条(中)', emoji: '🍟', desc: '现炸薯条', price: 12 },
    { name: '板烧鸡腿堡', emoji: '🍔', desc: '整块煎烤鸡腿', price: 22 },
    { name: '麦旋风', emoji: '🍦', desc: '奥利奥碎+冰淇淋', price: 13 },
    { name: '可乐(中)', emoji: '🥤', desc: '冰镇可口可乐', price: 10 },
    { name: '吉士汉堡', emoji: '🍔', desc: '牛肉饼+芝士', price: 14 }
  ],
  '必胜客宅急送': [
    { name: '超级至尊披萨 9 寸', emoji: '🍕', desc: '多种肉类+蔬菜', price: 79 },
    { name: '榴莲多多披萨 9 寸', emoji: '🍕', desc: '金枕榴莲果肉', price: 89 },
    { name: '奥尔良烤翅 4 只', emoji: '🍗', desc: '秘制奥尔良', price: 32 },
    { name: '浓情香鸡翼 4 只', emoji: '🍗', desc: '蜜汁烤制', price: 28 },
    { name: '酥皮奶油蛤蜊汤', emoji: '🍲', desc: '酥皮+奶油浓汤', price: 22 },
    { name: '香草凤尾虾 5 只', emoji: '🦐', desc: '面包糠炸制', price: 26 },
    { name: '柠檬红茶', emoji: '🍋', desc: '清爽解腻', price: 15 },
    { name: '鸡茸蘑菇汤', emoji: '🍲', desc: '浓郁奶香', price: 18 }
  ],
  '华莱士': [
    { name: '香辣鸡腿堡', emoji: '🍔', desc: '酥脆鸡腿排', price: 12 },
    { name: '鸡肉卷', emoji: '🌯', desc: '墨西哥风味', price: 11 },
    { name: '薯条(小)', emoji: '🍟', desc: '现炸金黄', price: 7 },
    { name: '香酥鸡腿', emoji: '🍗', desc: '整只炸鸡腿', price: 11 },
    { name: '黑椒鸡块 5 块', emoji: '🍗', desc: '配番茄酱', price: 10 },
    { name: '可乐(中)', emoji: '🥤', desc: '冰镇汽水', price: 7 },
    { name: '汉堡套餐', emoji: '🍔', desc: '汉堡+鸡米花+可乐', price: 22 },
    { name: '脆皮全鸡', emoji: '🍗', desc: '整只脆皮炸鸡', price: 28 }
  ],
  '德克士': [
    { name: '脆皮炸鸡', emoji: '🍗', desc: '咔滋脆皮', price: 18 },
    { name: '超级鸡腿堡', emoji: '🍔', desc: '大份鸡腿排', price: 20 },
    { name: '德克士鸡块 5 块', emoji: '🍗', desc: '配蜂蜜芥末酱', price: 14 },
    { name: '薯条(大)', emoji: '🍟', desc: '金黄酥脆', price: 13 },
    { name: '魔法鸡块 6 块', emoji: '🍗', desc: '孜然香辣', price: 16 },
    { name: '手枪腿', emoji: '🍗', desc: '整只大鸡腿', price: 22 },
    { name: '百事可乐(中)', emoji: '🥤', desc: '冰镇汽水', price: 10 },
    { name: '鸡肉卷', emoji: '🌯', desc: '嫩鸡肉卷饼', price: 15 }
  ],
  '汉堡王': [
    { name: '皇堡', emoji: '🍔', desc: '火烤牛肉饼+生菜番茄', price: 30 },
    { name: '安格斯厚牛堡', emoji: '🍔', desc: '安格斯牛肉饼', price: 35 },
    { name: '鸡腿堡', emoji: '🍔', desc: '香酥鸡腿排', price: 22 },
    { name: '王道椒香鸡腿', emoji: '🍗', desc: '椒麻风味', price: 16 },
    { name: '洋葱圈(大)', emoji: '🧅', desc: '酥脆洋葱圈', price: 14 },
    { name: '薯条(大)', emoji: '🍟', desc: '粗薯条', price: 13 },
    { name: '可乐(中)', emoji: '🥤', desc: '冰镇可口可乐', price: 10 },
    { name: '鸡盒(10块)', emoji: '🍗', desc: '香脆鸡块', price: 28 }
  ],
  '塔斯汀中国汉堡': [
    { name: '北京烤鸭中国汉堡', emoji: '🍔', desc: '烤鸭肉+葱丝甜面酱', price: 18 },
    { name: '藤椒鸡腿中国汉堡', emoji: '🌶️', desc: '藤椒麻香鸡腿', price: 16 },
    { name: '香辣鸡腿中国汉堡', emoji: '🍔', desc: '手擀饼皮+鸡腿排', price: 14 },
    { name: '堡胚薯条(大)', emoji: '🍟', desc: '现炸薯条', price: 11 },
    { name: '上校鸡块 6 块', emoji: '🍗', desc: '配甜辣酱', price: 13 },
    { name: '冰柠可乐', emoji: '🥤', desc: '柠檬+可乐', price: 8 },
    { name: '多汁牛肉中国汉堡', emoji: '🍔', desc: '牛肉饼+生菜', price: 17 },
    { name: '蛋挞 1 只', emoji: '🥧', desc: '奶香酥皮', price: 8 }
  ],
  // ===== 咖啡 =====
  '瑞幸咖啡': [
    { name: '生椰拿铁', emoji: '🥥', desc: '冷萃+厚椰乳', price: 19 },
    { name: '丝绒拿铁', emoji: '🥛', desc: '丝绒厚乳拿铁', price: 21 },
    { name: '标准美式(大杯)', emoji: '☕', desc: '中深烘焙', price: 15 },
    { name: '生酪拿铁', emoji: '🧀', desc: '生酪+拿铁', price: 22 },
    { name: '橙C美式', emoji: '🍊', desc: '橙汁+美式', price: 17 },
    { name: '碧根果拿铁', emoji: '🌰', desc: '碧根果糖浆', price: 24 },
    { name: '抓马西瓜拿铁', emoji: '🍉', desc: '西瓜风味拿铁', price: 23 },
    { name: '冰吸生椰拿铁', emoji: '🧊', desc: '清凉薄荷感', price: 22 }
  ],
  '星巴克': [
    { name: '拿铁(大杯)', emoji: '☕', desc: '浓缩+蒸奶', price: 32 },
    { name: '美式(大杯)', emoji: '☕', desc: '浓缩+热水', price: 28 },
    { name: '焦糖玛奇朵(大杯)', emoji: '🍮', desc: '香草+焦糖酱', price: 35 },
    { name: '抹茶拿铁(大杯)', emoji: '🍵', desc: '抹茶粉+牛奶', price: 34 },
    { name: '摩卡(大杯)', emoji: '🍫', desc: '巧克力+浓缩', price: 35 },
    { name: '冷萃咖啡(大杯)', emoji: '🧊', desc: '12小时低温萃取', price: 33 },
    { name: '星冰乐(大杯)', emoji: '🥤', desc: '咖啡星冰乐', price: 36 },
    { name: '燕麦拿铁(大杯)', emoji: '🥛', desc: '燕麦奶+浓缩', price: 36 }
  ],
  '库迪咖啡': [
    { name: '生椰拿铁', emoji: '🥥', desc: '厚椰乳+浓缩', price: 13 },
    { name: '潘帕斯蓝生酪茉莉拿铁', emoji: '💙', desc: '蓝藻+生酪+茉莉', price: 16 },
    { name: '美式(大杯)', emoji: '☕', desc: '深烘焙', price: 10 },
    { name: '厚乳拿铁', emoji: '🥛', desc: '厚牛乳拿铁', price: 15 },
    { name: '星辰厚乳拿铁', emoji: '✨', desc: '蝶豆花+厚乳', price: 17 },
    { name: '柚见气泡美式', emoji: '🍊', desc: '西柚+气泡美式', price: 14 },
    { name: '开心果芝芝拿铁', emoji: '🌰', desc: '开心果+芝士', price: 18 },
    { name: '经典拿铁', emoji: '☕', desc: '浓缩+牛奶', price: 12 }
  ],
  'Manner咖啡': [
    { name: '冰拿铁', emoji: '🥛', desc: '浓缩+冰牛奶', price: 15 },
    { name: '冰美式', emoji: '☕', desc: '浓缩+冰水', price: 15 },
    { name: '燕麦拿铁', emoji: '🥛', desc: '燕麦奶拿铁', price: 20 },
    { name: '橘皮拿铁', emoji: '🍊', desc: '橘皮风味', price: 18 },
    { name: '桂花拿铁', emoji: '🌸', desc: '桂花糖浆', price: 20 },
    { name: '海盐焦糖拿铁', emoji: '🍮', desc: '海盐+焦糖', price: 20 },
    { name: 'dirty', emoji: '☕', desc: '浓缩+冰牛奶分层', price: 20 },
    { name: '清橙美式', emoji: '🍊', desc: '橙汁+美式', price: 18 }
  ],
  'Tims咖啡': [
    { name: '深度拿铁', emoji: '☕', desc: '深度烘焙拿铁', price: 28 },
    { name: '美式咖啡(大)', emoji: '☕', desc: '深度烘焙美式', price: 22 },
    { name: '生椰冷萃', emoji: '🥥', desc: '冷萃+厚椰乳', price: 26 },
    { name: '肉桂提子贝果', emoji: '🥯', desc: '肉桂+提子干', price: 15 },
    { name: '芝心乳酪贝果', emoji: '🥯', desc: '奶油乳酪夹心', price: 16 },
    { name: '甜甜圈', emoji: '🍩', desc: '经典糖霜', price: 12 },
    { name: '燕麦拿铁', emoji: '🥛', desc: '燕麦奶拿铁', price: 30 },
    { name: '柠檬气泡美式', emoji: '🍋', desc: '柠檬+气泡美式', price: 24 }
  ],
  'Seesaw咖啡': [
    { name: '冷萃咖啡', emoji: '🧊', desc: '低温萃取', price: 28 },
    { name: '燕麦拿铁', emoji: '🥛', desc: '燕麦奶拿铁', price: 30 },
    { name: '生椰拿铁', emoji: '🥥', desc: '厚椰乳拿铁', price: 28 },
    { name: '美式咖啡', emoji: '☕', desc: '意式浓缩美式', price: 25 },
    { name: '拿铁', emoji: '☕', desc: '浓缩+蒸奶', price: 28 },
    { name: '桂花拿铁', emoji: '🌸', desc: '桂花风味', price: 32 },
    { name: 'Dirty', emoji: '☕', desc: '浓缩+冰牛奶', price: 30 },
    { name: '杏桃花蜂蜜拿铁', emoji: '🍑', desc: '杏桃花+蜂蜜', price: 32 }
  ],
  // ===== 茶饮 =====
  '蜜雪冰城': [
    { name: '珍珠奶茶', emoji: '🧋', desc: '黑糖珍珠+奶茶', price: 6 },
    { name: '柠檬水', emoji: '🍋', desc: '鲜切柠檬', price: 4 },
    { name: '满杯百香果', emoji: '🥤', desc: '百香果+绿茶', price: 8 },
    { name: '摩天脆脆冰淇淋', emoji: '🍦', desc: '香草冰淇淋甜筒', price: 3 },
    { name: '棒打鲜橙', emoji: '🍊', desc: '鲜橙果肉', price: 8 },
    { name: '冰鲜柠檬水', emoji: '🍋', desc: '柠檬+蜂蜜', price: 5 },
    { name: '芋圆奶茶', emoji: '🧋', desc: '芋圆+奶茶', price: 8 },
    { name: '蜜桃四季春', emoji: '🍑', desc: '蜜桃+四季春茶', price: 8 }
  ],
  '古茗': [
    { name: '杨枝甘露', emoji: '🥭', desc: '芒果+西柚+椰奶', price: 16 },
    { name: '超A芝士葡萄', emoji: '🍇', desc: '葡萄+芝士奶盖', price: 18 },
    { name: '布蕾脆脆奶芙', emoji: '🍮', desc: '布蕾+碧根果碎', price: 16 },
    { name: '奶茶三兄弟', emoji: '🧋', desc: '珍珠+椰果+布丁', price: 13 },
    { name: '云顶茉莉', emoji: '🌸', desc: '茉莉绿茶+奶油顶', price: 15 },
    { name: '满杯鲜橙', emoji: '🍊', desc: '鲜橙果茶', price: 14 },
    { name: '牛油果巴旦木奶昔', emoji: '🥑', desc: '牛油果+巴旦木', price: 20 },
    { name: '生椰拿铁冰', emoji: '🥥', desc: '生椰+咖啡', price: 16 }
  ],
  '茶百道': [
    { name: '豆乳玉麒麟', emoji: '🥛', desc: '豆乳奶盖+黄豆粉', price: 18 },
    { name: '杨枝甘露', emoji: '🥭', desc: '芒果+西柚+椰奶', price: 18 },
    { name: '超级杯水果茶', emoji: '🍉', desc: '多种水果+茶', price: 19 },
    { name: '生椰西瓜', emoji: '🍉', desc: '西瓜+生椰乳', price: 16 },
    { name: '芋圆奶茶', emoji: '🧋', desc: '手工芋圆', price: 15 },
    { name: '蜜桃乌龙', emoji: '🍑', desc: '蜜桃+乌龙茶', price: 14 },
    { name: '乌漆嘛黑', emoji: '⚫', desc: '桑葚果茶', price: 18 },
    { name: '西瓜啵啵', emoji: '🍉', desc: '西瓜果肉', price: 14 }
  ],
  '喜茶': [
    { name: '多肉葡萄', emoji: '🍇', desc: '巨峰葡萄果肉', price: 25 },
    { name: '芝芝莓莓', emoji: '🍓', desc: '草莓+芝士奶盖', price: 26 },
    { name: '满杯红柚', emoji: '🍊', desc: '红西柚果肉', price: 22 },
    { name: '生椰拿铁', emoji: '🥥', desc: '厚椰乳拿铁', price: 24 },
    { name: '芋泥波波牛乳', emoji: '🍠', desc: '芋泥+黑糖波波', price: 22 },
    { name: '烤黑糖波波牛乳', emoji: '🧋', desc: '黑糖波波+牛乳', price: 22 },
    { name: '多肉桃李', emoji: '🍑', desc: '三华李+桃肉', price: 22 },
    { name: '轻芒芒甘露', emoji: '🥭', desc: '芒果+椰奶', price: 22 }
  ],
  '沪上阿姨': [
    { name: '杨枝甘露', emoji: '🥭', desc: '芒果+西柚+椰奶', price: 17 },
    { name: '葡萄柠檬茶', emoji: '🍇', desc: '葡萄+柠檬茶', price: 16 },
    { name: '厚芋泥波波奶茶', emoji: '🍠', desc: '芋泥+波波', price: 16 },
    { name: '草莓桃子大福', emoji: '🍓', desc: '草莓+桃子', price: 17 },
    { name: '烤栗子脏脏奶芙', emoji: '🌰', desc: '栗子+奶芙', price: 18 },
    { name: '茉莉奶绿', emoji: '🌸', desc: '茉莉花+奶绿', price: 14 },
    { name: '血糯米奶茶', emoji: '🍚', desc: '血糯米+奶茶', price: 15 },
    { name: '百香果柠檬茶', emoji: '🥤', desc: '百香果+柠檬', price: 14 }
  ],
  '书亦烧仙草': [
    { name: '烧仙草大满贯', emoji: '🍮', desc: '仙草+芋圆+红豆+花生', price: 16 },
    { name: '牛魔王黑砖奶茶', emoji: '🧋', desc: '黑糖冻+奶茶', price: 14 },
    { name: '杨枝甘露', emoji: '🥭', desc: '芒果+西柚+椰奶', price: 17 },
    { name: '芋泥全家福', emoji: '🍠', desc: '芋泥+小料', price: 16 },
    { name: '生椰板栗拿铁', emoji: '🌰', desc: '板栗+生椰+咖啡', price: 17 },
    { name: '橙漫山茶花', emoji: '🍊', desc: '橙子+山茶花茶', price: 15 },
    { name: '葡萄酸奶冰', emoji: '🍇', desc: '葡萄+酸奶冰沙', price: 16 },
    { name: '黑糖小芋圆奶茶', emoji: '🧋', desc: '黑糖+芋圆', price: 14 }
  ],
  'CoCo都可': [
    { name: '珍珠奶茶', emoji: '🧋', desc: '珍珠+奶茶', price: 12 },
    { name: '鲜芋奶茶', emoji: '🍠', desc: '芋泥+奶茶', price: 15 },
    { name: '三兄弟奶茶', emoji: '🧋', desc: '珍珠+布丁+椰果', price: 16 },
    { name: '鲜百香双响炮', emoji: '🥤', desc: '百香果+珍珠+椰果', price: 16 },
    { name: '柠檬蜜西米露', emoji: '🍋', desc: '柠檬+西米', price: 13 },
    { name: '茉香奶茶', emoji: '🌸', desc: '茉莉花茶+奶', price: 13 },
    { name: '巧克力奶茶', emoji: '🍫', desc: '巧克力+奶茶', price: 15 },
    { name: '美式咖啡', emoji: '☕', desc: '意式美式', price: 14 }
  ],
  '奈雪的茶': [
    { name: '霸气葡萄', emoji: '🍇', desc: '巨峰葡萄+茶', price: 28 },
    { name: '霸气芝士草莓', emoji: '🍓', desc: '草莓+芝士奶盖', price: 28 },
    { name: '霸气橙子', emoji: '🍊', desc: '鲜橙+茶', price: 25 },
    { name: '生椰拿铁', emoji: '🥥', desc: '厚椰乳拿铁', price: 24 },
    { name: '霸气杨梅', emoji: '🍒', desc: '杨梅果茶', price: 28 },
    { name: '宝藏茶·金桂', emoji: '🌸', desc: '桂花+奶茶', price: 26 },
    { name: '霸气芒果', emoji: '🥭', desc: '芒果果茶', price: 27 },
    { name: '冰博克厚牛乳', emoji: '🥛', desc: '浓醇牛乳', price: 24 }
  ],
  '柠季手打柠檬茶': [
    { name: '招牌手打柠檬茶', emoji: '🍋', desc: '现打香水柠檬', price: 14 },
    { name: '鸭屎香柠檬茶', emoji: '🍋', desc: '鸭屎香茶底', price: 16 },
    { name: '茉莉手打柠檬茶', emoji: '🌸', desc: '茉莉茶底', price: 15 },
    { name: '超爽葱油面', emoji: '🍜', desc: '葱油拌面', price: 12 },
    { name: '梅菜扣肉饭', emoji: '🍚', desc: '梅菜扣肉套餐', price: 18 },
    { name: '冰摇茉莉花茶', emoji: '🌿', desc: '冰摇茉莉', price: 13 },
    { name: '葡萄柠檬茶', emoji: '🍇', desc: '葡萄+柠檬茶', price: 16 },
    { name: '桃桃柠檬茶', emoji: '🍑', desc: '桃子+柠檬茶', price: 16 }
  ],
  // ===== 火锅 =====
  '海底捞火锅': [
    { name: '番茄锅底(半份)', emoji: '🍲', desc: '浓郁番茄汤底', price: 38 },
    { name: '四宫格锅底', emoji: '🍲', desc: '4种口味任选', price: 68 },
    { name: '捞派毛肚(半份)', emoji: '🥩', desc: '七上八下脆嫩', price: 36 },
    { name: '虾滑', emoji: '🦐', desc: '手打青虾滑', price: 32 },
    { name: '肥牛卷(半份)', emoji: '🥓', desc: '肥牛现切', price: 28 },
    { name: '鲜鸭血', emoji: '🩸', desc: '嫩滑鸭血', price: 16 },
    { name: '海底捞捞面', emoji: '🍜', desc: '手工拉面表演', price: 12 },
    { name: '冰粉', emoji: '🍧', desc: '红糖山楂碎', price: 9 }
  ],
  '呷哺呷哺': [
    { name: '麻辣锅底(小锅)', emoji: '🌶️', desc: '一人一锅麻辣', price: 18 },
    { name: '清汤锅底(小锅)', emoji: '🍲', desc: '清汤底', price: 12 },
    { name: '精选肥牛(中份)', emoji: '🥓', desc: '肥牛卷', price: 32 },
    { name: '呷哺羔羊肉(中份)', emoji: '🥩', desc: '羔羊肉卷', price: 34 },
    { name: '虾滑(小份)', emoji: '🦐', desc: '手打虾滑', price: 22 },
    { name: '麻酱调料', emoji: '🥣', desc: '秘制麻酱', price: 6 },
    { name: '蔬菜拼盘', emoji: '🥬', desc: '多种时蔬', price: 18 },
    { name: '菌菇拼盘', emoji: '🍄', desc: '金针菇+香菇', price: 16 }
  ],
  '小龙坎火锅': [
    { name: '牛油红锅(小)', emoji: '🌶️', desc: '正宗牛油锅底', price: 39 },
    { name: '鸳鸯锅(小)', emoji: '🍲', desc: '红汤+清汤', price: 45 },
    { name: '脆嫩毛肚(小份)', emoji: '🥩', desc: '鲜毛肚', price: 32 },
    { name: '水晶牛肉', emoji: '🥩', desc: '嫩滑牛肉', price: 36 },
    { name: '手工虾滑', emoji: '🦐', desc: '鲜虾手打', price: 28 },
    { name: '贡菜', emoji: '🥬', desc: '脆爽贡菜', price: 14 },
    { name: '酥肉(小份)', emoji: '🍗', desc: '现炸酥肉', price: 18 },
    { name: '红糖糍粑', emoji: '🍡', desc: '外酥里糯', price: 14 }
  ],
  '巴奴毛肚火锅': [
    { name: '招牌毛肚(大份)', emoji: '🥩', desc: '水牛毛肚脆嫩', price: 68 },
    { name: '野山菌汤(锅底)', emoji: '🍲', desc: '多种野山菌熬制', price: 38 },
    { name: '鲜鸭血', emoji: '🩸', desc: '嫩滑鸭血', price: 18 },
    { name: '茴香小油条', emoji: '🥖', desc: '茴香风味油条', price: 14 },
    { name: '绣球菌', emoji: '🍄', desc: '脆嫩绣球菌', price: 22 },
    { name: '虾滑', emoji: '🦐', desc: '手打虾滑', price: 36 },
    { name: '雪花牛肉', emoji: '🥩', desc: '雪花纹理', price: 58 },
    { name: '冰粉', emoji: '🍧', desc: '红糖冰粉', price: 10 }
  ],
  // ===== 中式快餐 =====
  '老乡鸡': [
    { name: '肥西老母鸡汤', emoji: '🍲', desc: '农家老母鸡炖汤', price: 16 },
    { name: '竹笋蒸鸡翅', emoji: '🍗', desc: '竹笋+鸡翅蒸制', price: 18 },
    { name: '农家小炒肉', emoji: '🌶️', desc: '湘菜小炒肉', price: 16 },
    { name: '鸡汁腊味合蒸', emoji: '🍚', desc: '腊味合蒸', price: 18 },
    { name: '梅菜扣肉', emoji: '🍖', desc: '梅菜+五花肉', price: 20 },
    { name: '香干炒肉', emoji: '🍚', desc: '香干+肉片', price: 14 },
    { name: '西红柿鸡蛋', emoji: '🍅', desc: '家常番茄炒蛋', price: 12 },
    { name: '米饭', emoji: '🍚', desc: '东北大米', price: 2 }
  ],
  '米村拌饭': [
    { name: '石锅拌饭', emoji: '🍚', desc: '配菜+辣酱拌饭', price: 18 },
    { name: '烤牛肉拌饭', emoji: '🥩', desc: '烤牛肉+拌饭', price: 22 },
    { name: '金枪鱼拌饭', emoji: '🐟', desc: '金枪鱼+拌饭', price: 20 },
    { name: '朝鲜族冷面', emoji: '🍜', desc: '酸甜冷面', price: 18 },
    { name: '石板豆腐', emoji: '🥘', desc: '嫩豆腐石板烧', price: 16 },
    { name: '石板鸡蛋', emoji: '🥚', desc: '鸡蛋石板烧', price: 14 },
    { name: '香辣鱿鱼', emoji: '🦑', desc: '韩式香辣鱿鱼', price: 22 },
    { name: '海带汤', emoji: '🍲', desc: '韩式海带汤', price: 8 }
  ],
  '黄焖鸡米饭': [
    { name: '黄焖鸡(大份)', emoji: '🍛', desc: '鲜嫩鸡腿+土豆', price: 26 },
    { name: '黄焖鸡(中份)', emoji: '🍛', desc: '鸡腿肉+香菇', price: 22 },
    { name: '黄焖排骨(大份)', emoji: '🍖', desc: '排骨+土豆', price: 30 },
    { name: '黄焖豆腐', emoji: '🥘', desc: '嫩豆腐黄焖', price: 16 },
    { name: '米饭', emoji: '🍚', desc: '东北大米', price: 2 },
    { name: '红烧茄子', emoji: '🍆', desc: '红烧茄子', price: 14 },
    { name: '酸辣土豆丝', emoji: '🥔', desc: '酸辣土豆丝', price: 10 },
    { name: '紫菜蛋花汤', emoji: '🍲', desc: '紫菜+蛋花', price: 6 }
  ],
  '真功夫': [
    { name: '香滑蒸蛋', emoji: '🥚', desc: '嫩滑蒸水蛋', price: 8 },
    { name: '蒸水蛋套餐', emoji: '🍱', desc: '蒸蛋+青菜+米饭', price: 18 },
    { name: '香菇鸡腿饭', emoji: '🍚', desc: '香菇+鸡腿肉', price: 22 },
    { name: '酸菜卤肉饭', emoji: '🍚', desc: '酸菜+卤肉', price: 20 },
    { name: '冬菇鸡腿肉饭', emoji: '🍚', desc: '冬菇+鸡腿', price: 21 },
    { name: '鱼香茄子饭', emoji: '🍆', desc: '鱼香茄子盖饭', price: 18 },
    { name: '虫草花瘦肉汤', emoji: '🍲', desc: '虫草花+瘦肉', price: 10 },
    { name: '米饭', emoji: '🍚', desc: '五常大米', price: 2 }
  ],
  '永和大王': [
    { name: '大王香菇卤肉饭', emoji: '🍚', desc: '香菇+卤肉', price: 18 },
    { name: '秘制鸡腿排饭', emoji: '🍗', desc: '煎鸡腿排+饭', price: 22 },
    { name: '豆浆(热)', emoji: '🥛', desc: '现磨豆浆', price: 6 },
    { name: '油条', emoji: '🥖', desc: '现炸油条', price: 5 },
    { name: '台式牛肉面', emoji: '🍜', desc: '红烧牛肉+面', price: 24 },
    { name: '鲜肉小笼包', emoji: '🥟', desc: '小笼汤包', price: 16 },
    { name: '皮蛋瘦肉粥', emoji: '🍲', desc: '皮蛋+瘦肉粥', price: 12 },
    { name: '梅菜扣肉饭', emoji: '🍖', desc: '梅菜扣肉+饭', price: 20 }
  ],
  '吉野家': [
    { name: '招牌牛肉饭(中碗)', emoji: '🍚', desc: '肥牛+洋葱', price: 22 },
    { name: '招牌牛肉饭(大碗)', emoji: '🍚', desc: '肥牛+洋葱', price: 28 },
    { name: '咖喱牛肉饭', emoji: '🍛', desc: '日式咖喱+牛肉', price: 24 },
    { name: '照烧鸡排饭', emoji: '🍗', desc: '照烧鸡腿排', price: 22 },
    { name: '温泉蛋牛肉饭', emoji: '🍚', desc: '肥牛+温泉蛋', price: 24 },
    { name: '味增汤', emoji: '🍲', desc: '日式味增汤', price: 6 },
    { name: '泡菜', emoji: '🥬', desc: '日式泡菜', price: 5 },
    { name: '关东煮(3串)', emoji: '🍢', desc: '萝卜+鱼丸+魔芋', price: 12 }
  ],
  // ===== 粉面小吃 =====
  '杨国福麻辣烫': [
    { name: '麻辣烫(荤素自选 500g)', emoji: '🍲', desc: '骨汤汤底自选', price: 28 },
    { name: '麻辣烫(荤素自选 300g)', emoji: '🍲', desc: '骨汤汤底自选', price: 18 },
    { name: '肥牛麻辣烫套餐', emoji: '🥩', desc: '肥牛+配菜+粉', price: 32 },
    { name: '虾滑麻辣烫套餐', emoji: '🦐', desc: '虾滑+配菜+粉', price: 28 },
    { name: '鹌鹑蛋 4 个', emoji: '🥚', desc: '卤鹌鹑蛋', price: 6 },
    { name: '宽粉', emoji: '🍜', desc: '红薯宽粉', price: 8 },
    { name: '秘制麻酱', emoji: '🥣', desc: '杨国福秘制麻酱', price: 3 },
    { name: '酸梅汤', emoji: '🥤', desc: '解腻酸梅汤', price: 6 }
  ],
  '张亮麻辣烫': [
    { name: '麻辣烫(荤素自选 500g)', emoji: '🍲', desc: '骨汤+自选菜', price: 28 },
    { name: '麻辣烫(荤素自选 300g)', emoji: '🍲', desc: '骨汤+自选菜', price: 18 },
    { name: '羊肉卷麻辣烫', emoji: '🥩', desc: '羊肉卷+配菜', price: 30 },
    { name: '午餐肉麻辣烫', emoji: '🍖', desc: '午餐肉+配菜', price: 22 },
    { name: '面筋', emoji: '🍢', desc: '烤面筋', price: 5 },
    { name: '牛百叶', emoji: '🥩', desc: '脆嫩牛百叶', price: 12 },
    { name: '米饭', emoji: '🍚', desc: '东北大米', price: 2 },
    { name: '秘制蘸料', emoji: '🥣', desc: '张亮秘制蘸料', price: 3 }
  ],
  '沙县小吃': [
    { name: '飘香拌面', emoji: '🍜', desc: '花生酱拌面', price: 8 },
    { name: '蒸饺 10 只', emoji: '🥟', desc: '鲜肉蒸饺', price: 12 },
    { name: '馄饨(中碗)', emoji: '🥟', desc: '鲜肉小馄饨', price: 10 },
    { name: '乌鸡汤', emoji: '🍲', desc: '原盅乌鸡汤', price: 12 },
    { name: '柳叶蒸饺 8 只', emoji: '🥟', desc: '柳叶造型蒸饺', price: 10 },
    { name: '鸡腿饭', emoji: '🍗', desc: '卤鸡腿+饭', price: 16 },
    { name: '排骨汤面', emoji: '🍜', desc: '排骨+面条', price: 14 },
    { name: '卤蛋', emoji: '🥚', desc: '五香卤蛋', price: 3 }
  ],
  '兰州拉面': [
    { name: '牛肉拉面(大碗)', emoji: '🍜', desc: '一清二白三红四绿', price: 18 },
    { name: '牛肉拉面(小碗)', emoji: '🍜', desc: '一清二白三红四绿', price: 15 },
    { name: '红烧牛肉面(大碗)', emoji: '🍜', desc: '红烧牛肉+拉面', price: 22 },
    { name: '羊肉泡馍', emoji: '🍲', desc: '羊肉+馍', price: 24 },
    { name: '牛肉水饺 15 只', emoji: '🥟', desc: '牛肉水饺', price: 18 },
    { name: '凉拌黄瓜', emoji: '🥒', desc: '爽口黄瓜', price: 8 },
    { name: '卤牛肉(小份)', emoji: '🥩', desc: '卤牛肉片', price: 18 },
    { name: '杏皮水', emoji: '🥤', desc: '杏皮水饮料', price: 6 }
  ],
  '螺狮粉': [
    { name: '招牌螺蛳粉(加卤蛋)', emoji: '🍜', desc: '柳州螺蛳粉+卤蛋', price: 18 },
    { name: '原味螺蛳粉', emoji: '🍜', desc: '经典螺蛳粉', price: 15 },
    { name: '螺蛳粉+叉烧', emoji: '🍜', desc: '螺蛳粉+叉烧', price: 22 },
    { name: '螺蛳粉+鸭脚', emoji: '🍜', desc: '螺蛳粉+卤鸭脚', price: 20 },
    { name: '螺蛳粉+腐竹', emoji: '🍜', desc: '螺蛳粉+炸腐竹', price: 17 },
    { name: '卤蛋', emoji: '🥚', desc: '五香卤蛋', price: 3 },
    { name: '酸笋', emoji: '🥢', desc: '广西酸笋', price: 4 },
    { name: '豆奶', emoji: '🥛', desc: '维他豆奶', price: 5 }
  ],
  // ===== 平台独家品牌 =====
  '夸父炸串': [
    { name: '招牌牛肉串 5 串', emoji: '🍢', desc: '现炸牛肉串', price: 15 },
    { name: '羊肉串 5 串', emoji: '🍢', desc: '孜然羊肉串', price: 18 },
    { name: '里脊肉串 5 串', emoji: '🍢', desc: '嫩滑里脊肉', price: 12 },
    { name: '鸡翅 2 只', emoji: '🍗', desc: '香辣鸡翅', price: 14 },
    { name: '土豆片 5 串', emoji: '🥔', desc: '炸土豆片', price: 8 },
    { name: '平菇 5 串', emoji: '🍄', desc: '炸平菇', price: 8 },
    { name: '鸡胗 5 串', emoji: '🍢', desc: '香辣鸡胗', price: 12 },
    { name: '年糕 3 串', emoji: '🍡', desc: '脆皮年糕', price: 8 }
  ],
  '袁记云饺': [
    { name: '鲜虾云吞(生 20 只)', emoji: '🥟', desc: '鲜虾云吞生品', price: 28 },
    { name: '玉米鲜肉水饺(生 20 只)', emoji: '🥟', desc: '玉米鲜肉饺', price: 22 },
    { name: '冬菇马蹄鲜肉云吞(生 20 只)', emoji: '🥟', desc: '冬菇马蹄馅', price: 24 },
    { name: '鲜虾蟹籽云吞(生 12 只)', emoji: '🥟', desc: '鲜虾+蟹籽', price: 26 },
    { name: '紫菜鲜肉云吞(熟 12 只)', emoji: '🥟', desc: '现煮紫菜鲜肉', price: 18 },
    { name: '招牌酸汤云吞面', emoji: '🍜', desc: '酸汤+云吞+面', price: 20 },
    { name: '红油抄手 12 只', emoji: '🥟', desc: '红油抄手', price: 18 },
    { name: '辣椒酱', emoji: '🌶️', desc: '自制辣椒酱', price: 5 }
  ],
  '盒马鲜生': [
    { name: '盒马日日鲜牛奶 1L', emoji: '🥛', desc: '当日鲜奶', price: 12 },
    { name: '丹东红颜草莓 250g', emoji: '🍓', desc: '新鲜草莓', price: 29 },
    { name: '智利车厘子 500g', emoji: '🍒', desc: 'JJ 级车厘子', price: 59 },
    { name: '三文鱼刺身 200g', emoji: '🐟', desc: '冰鲜三文鱼', price: 49 },
    { name: '波士顿龙虾(活)', emoji: '🦞', desc: '鲜活波士顿龙虾', price: 139 },
    { name: '澳洲肥牛卷 300g', emoji: '🥓', desc: '肥牛卷', price: 39 },
    { name: '椰青 1 个', emoji: '🥥', desc: '泰国椰青', price: 12 },
    { name: '混合坚果 250g', emoji: '🥜', desc: '每日坚果', price: 25 }
  ],
  '大润发优鲜': [
    { name: '伊利纯牛奶 250ml*12', emoji: '🥛', desc: '整箱纯牛奶', price: 39 },
    { name: '乐事薯片 70g', emoji: '🍟', desc: '原味薯片', price: 9 },
    { name: '康师傅红烧牛肉面 5 包', emoji: '🍜', desc: '方便面整包', price: 14 },
    { name: '农夫山泉 550ml*12', emoji: '💧', desc: '饮用水整包', price: 18 },
    { name: '双汇王中王火腿肠 240g', emoji: '🌭', desc: '火腿肠', price: 14 },
    { name: '洽洽香瓜子 308g', emoji: '🌻', desc: '恰恰瓜子', price: 12 },
    { name: '海天酱油 500ml', emoji: '🍶', desc: '鲜味酱油', price: 10 },
    { name: '蒙牛酸奶 100g*8', emoji: '🥛', desc: '酸奶整板', price: 25 }
  ],
  '好利来': [
    { name: '半熟芝士 5 枚', emoji: '🧀', desc: '招牌半熟芝士', price: 39 },
    { name: '蜂蜜蛋糕 1 个', emoji: '🍯', desc: '经典蜂蜜蛋糕', price: 19 },
    { name: '芝士蛋糕 1 个', emoji: '🍰', desc: '轻乳酪芝士蛋糕', price: 29 },
    { name: '草莓奶油面包', emoji: '🍓', desc: '草莓奶油夹心', price: 16 },
    { name: '丹麦牛角包', emoji: '🥐', desc: '千层牛角包', price: 12 },
    { name: '肉松小贝 3 个', emoji: '🍘', desc: '肉松小贝', price: 22 },
    { name: '巧克力蛋糕卷', emoji: '🍫', desc: '巧克力蛋糕卷', price: 24 },
    { name: '老婆饼 5 个', emoji: '🥮', desc: '酥皮老婆饼', price: 18 }
  ],
  '七鲜美食超市': [
    { name: '7FRESH 鲜牛奶 1L', emoji: '🥛', desc: '巴氏鲜奶', price: 15 },
    { name: '招牌牛肉饭', emoji: '🍚', desc: '肥牛+洋葱饭', price: 24 },
    { name: '照烧鸡排饭', emoji: '🍗', desc: '照烧鸡腿排', price: 22 },
    { name: '麻辣香锅(单人)', emoji: '🌶️', desc: '荤素自选', price: 28 },
    { name: '三文鱼寿司 6 贯', emoji: '🍣', desc: '三文鱼握寿司', price: 36 },
    { name: '奥尔良烤鸡腿', emoji: '🍗', desc: '奥尔良风味', price: 14 },
    { name: '混合沙拉', emoji: '🥗', desc: '时蔬沙拉', price: 18 },
    { name: '鲜榨橙汁 500ml', emoji: '🍊', desc: '现榨橙汁', price: 18 }
  ],
  '京东便利店': [
    { name: '红牛维生素饮料 250ml', emoji: '🥤', desc: '功能饮料', price: 8 },
    { name: '脉动水蜜桃 600ml', emoji: '🍑', desc: '维生素饮料', price: 6 },
    { name: '康师傅冰红茶 500ml', emoji: '🧊', desc: '冰红茶', price: 4 },
    { name: '士力架花生夹心巧克力', emoji: '🍫', desc: '能量棒', price: 7 },
    { name: '达利园蛋黄派 250g', emoji: '🍰', desc: '蛋黄派', price: 12 },
    { name: '三只松鼠每日坚果 25g', emoji: '🥜', desc: '每日坚果', price: 8 },
    { name: '康师傅红烧牛肉面桶装', emoji: '🍜', desc: '桶面', price: 6 },
    { name: '双汇泡面拍档火腿肠', emoji: '🌭', desc: '火腿肠', price: 6 }
  ],
  '眉州东坡': [
    { name: '东坡肉', emoji: '🍖', desc: '招牌东坡肉', price: 48 },
    { name: '宫保鸡丁', emoji: '🥜', desc: '经典川味', price: 32 },
    { name: '麻婆豆腐', emoji: '🍲', desc: '麻辣鲜香', price: 22 },
    { name: '鱼香肉丝', emoji: '🥢', desc: '下饭神器', price: 28 },
    { name: '眉州香肠', emoji: '🥩', desc: '川味香肠', price: 36 },
    { name: '水煮牛肉', emoji: '🌶️', desc: '麻辣水煮', price: 42 },
    { name: '米饭', emoji: '🍚', desc: '东北大米', price: 3 },
    { name: '酸辣汤', emoji: '🍲', desc: '川味酸辣汤', price: 18 }
  ]
};

/** 品类兜底池（品牌无专属菜单时使用） */
const CATEGORY_POOL: Partial<Record<CategoryCode, DishDef[]>> = {
  burger: [
    { name: '招牌鸡腿堡', emoji: '🍔', desc: '酥脆鸡腿排', price: 20 },
    { name: '牛肉汉堡', emoji: '🍔', desc: '牛肉饼+生菜', price: 24 },
    { name: '香辣鸡翅 4 只', emoji: '🍗', desc: '香辣烤翅', price: 18 },
    { name: '薯条(大)', emoji: '🍟', desc: '现炸薯条', price: 12 },
    { name: '鸡米花(大)', emoji: '🍗', desc: '一口一个', price: 14 },
    { name: '鸡肉卷', emoji: '🌯', desc: '鸡肉+生菜', price: 14 },
    { name: '蛋挞 2 只', emoji: '🥧', desc: '酥皮蛋挞', price: 12 },
    { name: '可乐(中)', emoji: '🥤', desc: '冰镇汽水', price: 9 }
  ],
  chinese: [
    { name: '招牌卤肉饭', emoji: '🍚', desc: '台式卤肉', price: 22 },
    { name: '黄焖鸡米饭', emoji: '🍛', desc: '鸡腿+土豆', price: 20 },
    { name: '宫保鸡丁盖饭', emoji: '🍚', desc: '微辣川菜', price: 19 },
    { name: '红烧牛腩饭', emoji: '🥩', desc: '大块牛腩', price: 28 },
    { name: '鱼香肉丝套餐', emoji: '🥢', desc: '配例汤', price: 22 },
    { name: '农家小炒肉', emoji: '🌶️', desc: '湘菜风味', price: 24 },
    { name: '蒸饺 12 只', emoji: '🥟', desc: '手工蒸饺', price: 16 },
    { name: '例汤', emoji: '🍲', desc: '每日例汤', price: 8 }
  ],
  snack: [
    { name: '麻辣烫(中份)', emoji: '🍲', desc: '荤素自选', price: 22 },
    { name: '酸辣粉', emoji: '🌶️', desc: '红薯粉', price: 14 },
    { name: '炸串拼盘 15 串', emoji: '🍢', desc: '荤素搭配', price: 24 },
    { name: '鲜肉小馄饨', emoji: '🥟', desc: '皮薄馅大', price: 14 },
    { name: '牛肉面', emoji: '🍜', desc: '红烧牛肉', price: 18 },
    { name: '螺蛳粉', emoji: '🍜', desc: '柳州风味', price: 16 },
    { name: '卤味拼盘', emoji: '🍗', desc: '鸭脖鸭翅', price: 20 },
    { name: '手抓饼', emoji: '🥞', desc: '现烙手抓饼', price: 9 }
  ],
  coffee: [
    { name: '拿铁(大杯)', emoji: '☕', desc: '浓缩+蒸奶', price: 18 },
    { name: '美式(大杯)', emoji: '☕', desc: '意式美式', price: 15 },
    { name: '生椰拿铁', emoji: '🥥', desc: '厚椰乳', price: 19 },
    { name: '抹茶拿铁', emoji: '🍵', desc: '抹茶+奶', price: 22 },
    { name: '焦糖玛奇朵', emoji: '🍮', desc: '焦糖酱', price: 24 },
    { name: '冷萃咖啡', emoji: '🧊', desc: '低温萃取', price: 22 },
    { name: '燕麦拿铁', emoji: '🥛', desc: '燕麦奶', price: 24 },
    { name: '橙C美式', emoji: '🍊', desc: '橙汁美式', price: 17 }
  ],
  tea: [
    { name: '珍珠奶茶', emoji: '🧋', desc: '黑糖珍珠', price: 12 },
    { name: '杨枝甘露', emoji: '🥭', desc: '芒果+西柚', price: 17 },
    { name: '多肉葡萄', emoji: '🍇', desc: '葡萄果肉', price: 19 },
    { name: '柠檬茶', emoji: '🍋', desc: '现打柠檬', price: 12 },
    { name: '芝士草莓', emoji: '🍓', desc: '草莓+奶盖', price: 20 },
    { name: '烧仙草', emoji: '🍮', desc: '仙草+芋圆', price: 14 },
    { name: '满杯橙子', emoji: '🍊', desc: '鲜橙果茶', price: 15 },
    { name: '豆乳玉麒麟', emoji: '🥛', desc: '豆乳奶盖', price: 16 }
  ],
  hotpot: [
    { name: '双人火锅套餐', emoji: '🍲', desc: '锅底+4荤4素', price: 118 },
    { name: '单人冒菜套餐', emoji: '🌶️', desc: '麻辣锅底', price: 32 },
    { name: '毛肚(200g)', emoji: '🥩', desc: '脆嫩毛肚', price: 36 },
    { name: '虾滑', emoji: '🦐', desc: '手打虾滑', price: 30 },
    { name: '肥牛卷(250g)', emoji: '🥓', desc: '肥牛现切', price: 34 },
    { name: '菌菇拼盘', emoji: '🍄', desc: '多种菌菇', price: 18 },
    { name: '红糖糍粑', emoji: '🍡', desc: '外酥里糯', price: 12 },
    { name: '冰粉', emoji: '🍧', desc: '红糖冰粉', price: 8 }
  ]
};

/**
 * 从店名提取品牌名（店名格式：「品牌 · 商圈店」，取「·」前部分）
 */
function extractBrand(storeName: string): string {
  return storeName.split(/\s*[·•｜|]\s*/)[0].trim() || storeName;
}

/** 是否存在某品牌的标准菜单（供 UI 判断真实 POI 门店能否展示菜品） */
export function hasBrandMenu(brand?: string): boolean {
  return !!brand && Array.isArray(BRAND_MENU[brand]) && BRAND_MENU[brand].length > 0;
}

/**
 * 生成某门店的菜品列表
 * - 优先使用品牌专属菜单（BRAND_MENU），未命中回退到品类池
 * - brandOverride：由调用方确定品牌（如腾讯 POI 连锁识别结果），
 *   避免 POI 店名「肯德基(人民广场店)」提取品牌失败
 * - 打散取前 6 个，价格在基准价基础上 ±5% 浮动（同店稳定）
 * - 第 1 个标记为招牌
 */
export function buildStoreMenu(
  storeId: string,
  storeName: string,
  category: CategoryCode,
  brandOverride?: string
): Dish[] {
  const brand = brandOverride && BRAND_MENU[brandOverride]
    ? brandOverride
    : extractBrand(storeName);
  const pool = BRAND_MENU[brand] || CATEGORY_POOL[category] || CATEGORY_POOL.chinese || [];
  const rand = mulberry32(hashString(`menu-${storeId}-${brand}`));

  // 打散后取前 6 个
  const shuffled = [...pool].sort(() => rand() - 0.5).slice(0, 6);

  return shuffled.map((d, i) => ({
    id: `${storeId}-dish-${i + 1}`,
    name: d.name,
    emoji: d.emoji,
    desc: d.desc,
    // ±5% 浮动，保留一位小数（贴近真实标价）
    basePrice: Math.round(d.price * (0.95 + rand() * 0.1) * 10) / 10,
    monthlySales: (5 + Math.floor(rand() * 60)) * 10, // 50 ~ 640
    isSignature: i === 0,
    imageUrl: buildDishImageUrl(d.name, d.desc)
  }));
}
