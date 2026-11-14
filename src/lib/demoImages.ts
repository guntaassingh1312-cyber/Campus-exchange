import heroPecChandigarh from '../assets/images/hero_pec_chandigarh_1794605302120.jpg';
import mathTextbook from '../assets/images/product_math_textbook_1794600084346.jpg';
import scientificCalculator from '../assets/images/product_scientific_calculator_1794600085191.jpg';
import drawingBoard from '../assets/images/product_drawing_board_1794600085028.jpg';
import campusBicycle from '../assets/images/product_campus_bicycle_1794600085571.jpg';
import laptopStand from '../assets/images/product_laptop_stand_1794600085208.jpg';
import headphones from '../assets/images/product_headphones_1794600085693.jpg';
import studyTable from '../assets/images/product_study_table_1794600086233.jpg';
import mechanicalKeyboard from '../assets/images/product_mechanical_keyboard_1794600087911.jpg';
import labCoat from '../assets/images/product_lab_coat_1794605301776.jpg';
import vernierCaliper from '../assets/images/product_vernier_caliper_1794605301907.jpg';
import raspberryPi from '../assets/images/product_raspberry_pi_1794605302791.jpg';
import badmintonRacket from '../assets/images/product_badminton_racket_1794605303367.jpg';
import electricKettle from '../assets/images/product_electric_kettle_1794605303125.jpg';
import acousticGuitar from '../assets/images/product_acoustic_guitar_1794605303733.jpg';
import ganCharger from '../assets/images/product_gan_charger_1794605303568.jpg';
import bsGrewal from '../assets/images/product_bs_grewal_1794605304419.jpg';
import shopVerkaBooth from '../assets/images/shop_verka_booth_1794617818171.jpg';
import shopNescafeCorner from '../assets/images/shop_nescafe_corner_1794617818144.jpg';
import shopStudentCentre from '../assets/images/shop_student_centre_1794617818459.jpg';
import foodSnacksCombo from '../assets/images/food_snacks_combo_1794617818371.jpg';
import foodBeveragesCoffee from '../assets/images/food_beverages_coffee_1794617819150.jpg';
import foodMealsThali from '../assets/images/food_meals_thali_1794617819553.jpg';

export const HERO_CAMPUS_IMAGE = heroPecChandigarh;

const IMAGE_MAP: Record<string, string> = {
  '/src/assets/images/hero_pec_chandigarh_1794605302120.jpg': heroPecChandigarh,
  '/src/assets/images/product_math_textbook_1794600084346.jpg': mathTextbook,
  '/src/assets/images/product_scientific_calculator_1794600085191.jpg': scientificCalculator,
  '/src/assets/images/product_drawing_board_1794600085028.jpg': drawingBoard,
  '/src/assets/images/product_campus_bicycle_1794600085571.jpg': campusBicycle,
  '/src/assets/images/product_laptop_stand_1794600085208.jpg': laptopStand,
  '/src/assets/images/product_headphones_1794600085693.jpg': headphones,
  '/src/assets/images/product_study_table_1794600086233.jpg': studyTable,
  '/src/assets/images/product_mechanical_keyboard_1794600087911.jpg': mechanicalKeyboard,
  '/src/assets/images/product_lab_coat_1794605301776.jpg': labCoat,
  '/src/assets/images/product_vernier_caliper_1794605301907.jpg': vernierCaliper,
  '/src/assets/images/product_raspberry_pi_1794605302791.jpg': raspberryPi,
  '/src/assets/images/product_badminton_racket_1794605303367.jpg': badmintonRacket,
  '/src/assets/images/product_electric_kettle_1794605303125.jpg': electricKettle,
  '/src/assets/images/product_acoustic_guitar_1794605303733.jpg': acousticGuitar,
  '/src/assets/images/product_gan_charger_1794605303568.jpg': ganCharger,
  '/src/assets/images/product_bs_grewal_1794605304419.jpg': bsGrewal,
  '/src/assets/images/shop_verka_booth_1794617818171.jpg': shopVerkaBooth,
  '/src/assets/images/shop_nescafe_corner_1794617818144.jpg': shopNescafeCorner,
  '/src/assets/images/shop_student_centre_1794617818459.jpg': shopStudentCentre,
  '/src/assets/images/food_snacks_combo_1794617818371.jpg': foodSnacksCombo,
  '/src/assets/images/food_beverages_coffee_1794617819150.jpg': foodBeveragesCoffee,
  '/src/assets/images/food_meals_thali_1794617819553.jpg': foodMealsThali,
};

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return IMAGE_MAP[url] || url;
}
