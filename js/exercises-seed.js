export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Гърди', color: '#f87171' },
  { id: 'back', label: 'Гръб', color: '#60a5fa' },
  { id: 'legs', label: 'Крака', color: '#34d399' },
  { id: 'shoulders', label: 'Рамене', color: '#fbbf24' },
  { id: 'biceps', label: 'Бицепс', color: '#14b8a6' },
  { id: 'triceps', label: 'Трицепс', color: '#fb923c' },
  { id: 'core', label: 'Корем', color: '#f472b6' },
  { id: 'cardio', label: 'Кардио', color: '#22d3ee' },
];

export const DEFAULT_EXERCISES = [
  { name: 'Лежанка с щанга', muscleGroup: 'chest' },
  { name: 'Лежанка с дъмбели', muscleGroup: 'chest' },
  { name: 'Наклонена лежанка', muscleGroup: 'chest' },
  { name: 'Бътерфлай', muscleGroup: 'chest' },
  { name: 'Кросоувър', muscleGroup: 'chest' },
  { name: 'Лицеви опори', muscleGroup: 'chest' },

  { name: 'Лостове (Pull-up)', muscleGroup: 'back' },
  { name: 'Гребане с щанга', muscleGroup: 'back' },
  { name: 'Гребане с дъмбел', muscleGroup: 'back' },
  { name: 'Дърпане на лат машина', muscleGroup: 'back' },
  { name: 'Тяга', muscleGroup: 'back' },
  { name: 'Т-тяга', muscleGroup: 'back' },

  { name: 'Клек с щанга', muscleGroup: 'legs' },
  { name: 'Преса за крака', muscleGroup: 'legs' },
  { name: 'Мъртва тяга', muscleGroup: 'legs' },
  { name: 'Румънска тяга', muscleGroup: 'legs' },
  { name: 'Крачки (Lunges)', muscleGroup: 'legs' },
  { name: 'Разгъвка за квадрицепс', muscleGroup: 'legs' },
  { name: 'Свиване за бицепс бедро', muscleGroup: 'legs' },
  { name: 'Прасци прав', muscleGroup: 'legs' },

  { name: 'Военна преса', muscleGroup: 'shoulders' },
  { name: 'Странични разгъвки', muscleGroup: 'shoulders' },
  { name: 'Челни разгъвки', muscleGroup: 'shoulders' },
  { name: 'Обратни разгъвки', muscleGroup: 'shoulders' },
  { name: 'Арнолд преса', muscleGroup: 'shoulders' },

  { name: 'Бицепс с щанга', muscleGroup: 'biceps' },
  { name: 'Бицепс с дъмбели', muscleGroup: 'biceps' },
  { name: 'Чук (Hammer curl)', muscleGroup: 'biceps' },
  { name: 'Трицепс на въже', muscleGroup: 'triceps' },
  { name: 'Френска преса', muscleGroup: 'triceps' },
  { name: 'Успоредка (Dips)', muscleGroup: 'triceps' },

  { name: 'Коремни преси', muscleGroup: 'core' },
  { name: 'Повдигане на крака', muscleGroup: 'core' },
  { name: 'Дъска (Plank)', muscleGroup: 'core' },
  { name: 'Руски завъртания', muscleGroup: 'core' },

  { name: 'Бягане', muscleGroup: 'cardio' },
  { name: 'Колоездене', muscleGroup: 'cardio' },
  { name: 'Гребен уред', muscleGroup: 'cardio' },
  { name: 'Скачане на въже', muscleGroup: 'cardio' },
];
