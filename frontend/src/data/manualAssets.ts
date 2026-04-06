export interface ManualAsset {
  id: string;
  lessonId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  path: string;
  caption: string;
  alt: string;
  pageHint: string;
}

export const manualAssets: ManualAsset[] = [
  {
    id: 'l1-spectrum',
    lessonId: 1,
    path: '/assets/manual/images/page-015-img-01.jpeg',
    caption: 'Классификация освещения и визуальные условия рабочей зоны',
    alt: 'Схема производственного освещения из методички',
    pageHint: 'стр. ~15',
  },
  {
    id: 'l1-pulsation',
    lessonId: 1,
    path: '/assets/manual/images/page-017-img-01.png',
    caption: 'Пульсация светового потока и стробоскопический эффект',
    alt: 'Иллюстрация пульсации освещенности из методички',
    pageHint: 'стр. ~17',
  },
  {
    id: 'l2-layout',
    lessonId: 2,
    path: '/assets/manual/images/page-034-img-01.jpeg',
    caption: 'Схема расчета освещения методом коэффициента использования',
    alt: 'План помещения и размещение светильников',
    pageHint: 'стр. ~34',
  },
  {
    id: 'l2-table',
    lessonId: 2,
    path: '/assets/manual/images/page-039-img-01.png',
    caption: 'Табличные данные для расчета освещения (варианты)',
    alt: 'Таблица вариантов для расчета освещенности',
    pageHint: 'стр. ~39',
  },
  {
    id: 'l3-noise',
    lessonId: 3,
    path: '/assets/manual/images/page-056-img-01.png',
    caption: 'Шкалы и источники производственного шума',
    alt: 'Иллюстрация по шуму и уровням дБ',
    pageHint: 'стр. ~56',
  },
  {
    id: 'l3-barrier',
    lessonId: 3,
    path: '/assets/manual/images/page-058-img-01.png',
    caption: 'Влияние ограждающих конструкций на уровень шума',
    alt: 'Схема звукоизоляции преград',
    pageHint: 'стр. ~58',
  },
  {
    id: 'l4-delta',
    lessonId: 4,
    path: '/assets/manual/images/page-066-img-01.jpeg',
    caption: 'Таблица поправок ΔL для суммирования источников',
    alt: 'Таблица поправок для логарифмического суммирования уровней шума',
    pageHint: 'стр. ~66',
  },
  {
    id: 'l4-cases',
    lessonId: 4,
    path: '/assets/manual/images/page-067-img-01.png',
    caption: 'Сценарные варианты расчета уровней в контрольной точке',
    alt: 'Сценарные данные для расчета шума',
    pageHint: 'стр. ~67',
  },
  {
    id: 'l5-spectrum',
    lessonId: 5,
    path: '/assets/manual/images/page-093-img-01.png',
    caption: 'Шкала электромагнитных излучений и примеры источников',
    alt: 'Электромагнитный спектр из методички',
    pageHint: 'стр. ~93',
  },
  {
    id: 'l5-zones',
    lessonId: 5,
    path: '/assets/manual/images/page-094-img-01.jpeg',
    caption: 'Зоны вокруг источника электромагнитного излучения',
    alt: 'Ближняя, промежуточная и дальняя зоны вокруг источника',
    pageHint: 'стр. ~94',
  },
  {
    id: 'l6-waveguide',
    lessonId: 6,
    path: '/assets/manual-imported/Рисунок 6.1. Волновод.png',
    caption: 'Волновод — основной элемент экранирования ЭМИ',
    alt: 'Схема волновода',
    pageHint: 'стр. ~102',
  },
  {
    id: 'l6-circuit',
    lessonId: 6,
    path: '/assets/manual-imported/Рисунок 6.3. Схема выходного контура.png',
    caption: 'Схема выходного контура экранирующего устройства',
    alt: 'Схема выходного контура',
    pageHint: 'стр. ~104',
  },
  {
    id: 'l7-spectrum',
    lessonId: 7,
    path: '/assets/manual-imported/Рисунок 7.1. Диапазон ЭМП.png',
    caption: 'Диапазон электромагнитных полей ВЧ-излучений',
    alt: 'Диапазон ЭМП',
    pageHint: 'стр. ~110',
  },
  {
    id: 'l7-5g',
    lessonId: 7,
    path: '/assets/manual-imported/Рисунок 7.2. 5G и электромагнитный спектр.png',
    caption: '5G и электромагнитный спектр',
    alt: '5G технологии и электромагнитный спектр',
    pageHint: 'стр. ~112',
  },
  {
    id: 'l8-table',
    lessonId: 8,
    path: '/assets/manual-imported/table 8.1.png',
    caption: 'Таблица нормативов УВЧ-излучений',
    alt: 'Таблица 8.1',
    pageHint: 'стр. ~120',
  },
  {
    id: 'l8-table2',
    lessonId: 8,
    path: '/assets/manual-imported/table 8.2.png',
    caption: 'Исходные данные для расчёта УВЧ-передатчиков',
    alt: 'Таблица 8.2 — варианты',
    pageHint: 'стр. ~122',
  },
  {
    id: 'l9-burns',
    lessonId: 9,
    path: '/assets/manual-imported/Рисунок 9.1. Электрические ожоги.png',
    caption: 'Электрические ожоги — последствия поражения током',
    alt: 'Электрические ожоги',
    pageHint: 'стр. ~130',
  },
  {
    id: 'l9-circuit',
    lessonId: 9,
    path: '/assets/manual-imported/Рисунок 9.6. Эквивалентная схема сопротивления человека .png',
    caption: 'Эквивалентная схема сопротивления тела человека',
    alt: 'Электрическая схема замещения тела',
    pageHint: 'стр. ~134',
  },
  {
    id: 'l10-spread',
    lessonId: 10,
    path: '/assets/manual-imported/Рисунок 10.1. Зона распространения электрического тока.png',
    caption: 'Зона растекания тока в грунте',
    alt: 'Зона распространения тока',
    pageHint: 'стр. ~140',
  },
  {
    id: 'l10-stepv',
    lessonId: 10,
    path: '/assets/manual-imported/Рисунок 10.3. Шаговое напряжение - правила перемещения и радиус поражения.png',
    caption: 'Шаговое напряжение — правила перемещения и радиус поражения',
    alt: 'Шаговое напряжение',
    pageHint: 'стр. ~143',
  },
  {
    id: 'l11-fig-sample',
    lessonId: 11,
    path: '/assets/manual-imported/Рисунок 11.1. Электроустановка напряжением 0,4кВ с глухозаземленной нейтралью.png',
    caption: 'Рисунок 11.1 — электроустановка 0,4 кВ с глухозаземлённой нейтралью',
    alt: 'Схема электроустановки с глухозаземлённой нейтралью',
    pageHint: 'Занятие №11 методички',
  },
];

export function assetsByLesson(lessonId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11): ManualAsset[] {
  return manualAssets.filter((asset) => asset.lessonId === lessonId);
}

