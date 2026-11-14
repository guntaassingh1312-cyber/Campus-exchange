import { eq, isNull } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  listingPromotions,
  menuItems,
  messages,
  notifications,
  orders,
  paymentTransactions,
  platformSettings,
  premiumSubscriptions,
  productImages,
  productViewEvents,
  products,
  profiles,
  qrTokens,
  referralTransactions,
  referrals,
  reviews,
  shopReviews,
  shops,
  transactions,
} from './schema.ts';
import { hashPassword, hashQrToken } from '../lib/auth-server.ts';

let seedPromise: Promise<void> | null = null;

export const DEMO_PRODUCT_IMAGES = {
  textbook: '/src/assets/images/product_math_textbook_1794600084346.jpg',
  calculator: '/src/assets/images/product_scientific_calculator_1794600085191.jpg',
  drawingBoard: '/src/assets/images/product_drawing_board_1794600085028.jpg',
  bicycle: '/src/assets/images/product_campus_bicycle_1794600085571.jpg',
  laptopStand: '/src/assets/images/product_laptop_stand_1794600085208.jpg',
  headphones: '/src/assets/images/product_headphones_1794600085693.jpg',
  studyTable: '/src/assets/images/product_study_table_1794600086233.jpg',
  keyboard: '/src/assets/images/product_mechanical_keyboard_1794600087911.jpg',
  labCoat: '/src/assets/images/product_lab_coat_1794605301776.jpg',
  vernierCaliper: '/src/assets/images/product_vernier_caliper_1794605301907.jpg',
  raspberryPi: '/src/assets/images/product_raspberry_pi_1794605302791.jpg',
  badmintonRacket: '/src/assets/images/product_badminton_racket_1794605303367.jpg',
  electricKettle: '/src/assets/images/product_electric_kettle_1794605303125.jpg',
  acousticGuitar: '/src/assets/images/product_acoustic_guitar_1794605303733.jpg',
  ganCharger: '/src/assets/images/product_gan_charger_1794605303568.jpg',
  bsGrewal: '/src/assets/images/product_bs_grewal_1794605304419.jpg',
};

export const DEMO_EATERY_IMAGES = {
  verkaShop: '/src/assets/images/shop_verka_booth_1794617818171.jpg',
  nescafeShop: '/src/assets/images/shop_nescafe_corner_1794617818144.jpg',
  studentCentreShop: '/src/assets/images/shop_student_centre_1794617818459.jpg',
  snacksCombo: '/src/assets/images/food_snacks_combo_1794617818371.jpg',
  beveragesCoffee: '/src/assets/images/food_beverages_coffee_1794617819150.jpg',
  mealsThali: '/src/assets/images/food_meals_thali_1794617819553.jpg',
};

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  // Fast check: if the latest expanded product already exists, skip marketplace seeding work
  const [latestMarker] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.productCode, 'PM-PEC-10256'))
    .limit(1);

  if (latestMarker) {
    await seedEateries();
    await seedMonetization();
    return;
  }

  // 1. Seed Categories (idempotent)
  const categorySeed = [
    {
      name: 'Academic',
      slug: 'academic',
      description: 'Textbooks, scientific calculators, drawing boards, and lab kits.',
      subcategories: JSON.stringify([
        'Textbooks',
        'Scientific calculators',
        'Drawing boards',
        'Engineering instruments',
        'Lab accessories',
      ]),
    },
    {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Laptop accessories, keyboards, headphones, chargers, and peripherals.',
      subcategories: JSON.stringify([
        'Laptops and accessories',
        'Keyboards',
        'Headphones',
        'Chargers',
        'Computer peripherals',
      ]),
    },
    {
      name: 'Hostel and Lifestyle',
      slug: 'hostel-and-lifestyle',
      description: 'Study furniture, storage, kettles, bicycles, and hostel essentials.',
      subcategories: JSON.stringify([
        'Furniture',
        'Storage items',
        'Kitchen appliances',
        'Cycles',
        'Clothing and accessories',
      ]),
    },
    {
      name: 'Sports and Recreation',
      slug: 'sports-and-recreation',
      description: 'Rackets, musical instruments, fitness gear, and board games.',
      subcategories: JSON.stringify([
        'Sports equipment',
        'Musical instruments',
        'Fitness accessories',
        'Board games',
      ]),
    },
    {
      name: 'Miscellaneous',
      slug: 'miscellaneous',
      description: 'Event passes, craft supplies, and other campus essentials.',
      subcategories: JSON.stringify(['General']),
    },
  ];

  for (const cat of categorySeed) {
    await db
      .insert(categories)
      .values(cat)
      .onConflictDoNothing({ target: categories.slug });
  }

  // 2. Seed PEC Student Profiles (14 Verified Students + 1 Pending + 1 Admin)
  const studentPasswordHash = await hashPassword('pecdemo123');
  const adminPasswordHash = await hashPassword('pecadmin123');

  const profileSeed = [
    {
      studentId: '22103011',
      fullName: 'Aarav Sharma',
      institutionalEmail: 'aarav.sharma@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Computer Science & Engineering',
      academicYear: '3rd Year (Sem 6)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Himalaya Hostel',
      bio: 'CSE pre-final year student. Renting out engineering instruments and selling semester books.',
    },
    {
      studentId: '22104028',
      fullName: 'Diya Verma',
      institutionalEmail: 'diya.verma@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Electronics & Communication Engineering',
      academicYear: '2nd Year (Sem 4)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Kalpana Chawla Hostel',
      bio: 'ECE undergrad active in Robotics Society. Love sustainable campus sharing.',
    },
    {
      studentId: '21102019',
      fullName: 'Rohan Gill',
      institutionalEmail: 'rohan.gill@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Mechanical Engineering',
      academicYear: '4th Year (Sem 8)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Shivalik Hostel',
      bio: 'Graduating Mechanical senior passing on hostel furniture, cycle, and lab gear.',
    },
    {
      studentId: '22105014',
      fullName: 'Simranjit Kaur',
      institutionalEmail: 'simranjit.kaur@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Electrical Engineering',
      academicYear: '3rd Year (Sem 6)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Vindhya Hostel',
      bio: 'Electrical engineering student & Music Club guitarist. Sharing electronics and instruments.',
    },
    {
      studentId: '23101042',
      fullName: 'Kabir Bedi',
      institutionalEmail: 'kabir.bedi@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Civil Engineering',
      academicYear: '2nd Year (Sem 4)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Kurukshetra Hostel',
      bio: 'Civil undergrad sharing drafting tools, sports gear, and first-year reference texts.',
    },
    {
      studentId: '21106008',
      fullName: 'Ananya Mahajan',
      institutionalEmail: 'ananya.mahajan@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Aerospace Engineering',
      academicYear: '4th Year (Sem 8)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Kalpana Chawla Hostel',
      bio: 'Aerospace senior wrapping up hostel life—clean appliances and precision instruments.',
    },
    {
      studentId: '23103067',
      fullName: 'Pranav Jindal',
      institutionalEmail: 'pranav.jindal@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Computer Science & Engineering',
      academicYear: '2nd Year (Sem 4)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Aravali Hostel',
      bio: 'ACM & Coding Club member. Renting out IoT boards and tech accessories.',
    },
    {
      studentId: '22107031',
      fullName: 'Harpreet Singh',
      institutionalEmail: 'harpreet.singh@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Metallurgical & Materials Engineering',
      academicYear: '3rd Year (Sem 6)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Shivalik Hostel',
      bio: 'Metallurgy undergrad & PEC Badminton team player.',
    },
    {
      studentId: '23108019',
      fullName: 'Mehak Garg',
      institutionalEmail: 'mehak.garg@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Production & Industrial Engineering',
      academicYear: '2nd Year (Sem 4)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Vindhya Hostel',
      bio: 'PIE sophomore sharing workshop lab coats and calipers for first-year batches.',
    },
    {
      studentId: '22103088',
      fullName: 'Vivaan Malhotra',
      institutionalEmail: 'vivaan.malhotra@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Computer Science & Engineering',
      academicYear: '3rd Year (Sem 6)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Himalaya Hostel',
      bio: 'Full-stack builder at PEC Innovation Lab.',
    },
    {
      studentId: '21104055',
      fullName: 'Ishita Bansal',
      institutionalEmail: 'ishita.bansal@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Electronics & Communication Engineering',
      academicYear: '4th Year (Sem 8)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Kalpana Chawla Hostel',
      bio: 'VLSI final-year student passing down lab kits and textbooks.',
    },
    {
      studentId: '23102073',
      fullName: 'Arjun Sandhu',
      institutionalEmail: 'arjun.sandhu@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Mechanical Engineering',
      academicYear: '2nd Year (Sem 4)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Kurukshetra Hostel',
      bio: 'PEC SAE Baja team member sharing workshop tools.',
    },
    {
      studentId: '22105092',
      fullName: 'Niharika Chopra',
      institutionalEmail: 'niharika.chopra@pec.edu.in',
      passwordHash: studentPasswordHash,
      department: 'Electrical Engineering',
      academicYear: '3rd Year (Sem 6)',
      role: 'student',
      verificationStatus: 'verified',
      hostelBlock: 'Vindhya Hostel',
      bio: 'Hostel mess coordinator & campus sustainability advocate.',
    },
    {
      studentId: '24109099',
      fullName: 'Kabir Mehta',
      institutionalEmail: 'kabir.mehta.guest@gmail.com',
      passwordHash: studentPasswordHash,
      department: 'Production & Industrial Engineering',
      academicYear: '1st Year (Sem 2)',
      role: 'student',
      verificationStatus: 'pending',
      hostelBlock: 'Aravali Hostel',
      bio: 'Freshman awaiting institutional ID verification.',
    },
    {
      studentId: 'ADMIN-PEC',
      fullName: 'PEC Campus Moderator',
      institutionalEmail: 'admin.pingme@pec.edu.in',
      passwordHash: adminPasswordHash,
      department: 'Campus Administration',
      academicYear: 'Staff',
      role: 'admin',
      verificationStatus: 'verified',
      hostelBlock: 'Admin Block',
      bio: 'Official PingME PEC Chandigarh marketplace verification & safety moderator.',
    },
  ];

  const profileByStudentId = new Map<string, typeof profiles.$inferSelect>();

  for (const p of profileSeed) {
    await db
      .insert(profiles)
      .values(p)
      .onConflictDoNothing({ target: profiles.studentId });

    const [row] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.studentId, p.studentId))
      .limit(1);
    if (row) profileByStudentId.set(p.studentId, row);
  }

  const aarav = profileByStudentId.get('22103011')!;
  const diya = profileByStudentId.get('22104028')!;
  const rohan = profileByStudentId.get('21102019')!;
  const simran = profileByStudentId.get('22105014')!;
  const kabirB = profileByStudentId.get('23101042')!;
  const ananya = profileByStudentId.get('21106008')!;
  const pranav = profileByStudentId.get('23103067')!;
  const harpreet = profileByStudentId.get('22107031')!;
  const mehak = profileByStudentId.get('23108019')!;

  // 3. Seed 16 Realistic PEC Campus Products (idempotent by productCode)
  const demoProducts = [
    {
      productCode: 'PM-PEC-10241',
      sellerId: aarav.id,
      title: 'Engineering Mathematics Textbook (8th Ed. Stroud)',
      description:
        'Clean hardcover edition by K.A. Stroud & Dexter J. Booth. Zero torn pages, minimal pencil notes in chapters 1-3. Essential for PEC 1st & 2nd semester calculus and differential equations.',
      category: 'Academic',
      subcategory: 'Textbooks',
      condition: 'Like New',
      listingType: 'sell',
      sellingPrice: 250,
      negotiable: true,
      rentalPriceDaily: null,
      rentalPriceWeekly: null,
      rentalPriceMonthly: null,
      securityDeposit: 0,
      pickupLocation: 'PEC Central Library Steps',
      hostelOrDept: 'Himalaya Hostel / CSE Dept',
      imageUrl: DEMO_PRODUCT_IMAGES.textbook,
      viewCount: 42,
    },
    {
      productCode: 'PM-PEC-10242',
      sellerId: aarav.id,
      title: 'Casio FX-991EX ClassWiz Scientific Calculator',
      description:
        'Original non-programmable scientific calculator approved for all PEC mid-sem & end-sem exams. Solar + battery powered with slide-on hard protective case.',
      category: 'Academic',
      subcategory: 'Scientific calculators',
      condition: 'Like New',
      listingType: 'rent',
      sellingPrice: null,
      negotiable: false,
      rentalPriceDaily: 25,
      rentalPriceWeekly: 140,
      rentalPriceMonthly: 450,
      securityDeposit: 300,
      pickupLocation: 'Lecture Theatre Complex (LTC) Foyer',
      hostelOrDept: 'Himalaya Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.calculator,
      viewCount: 89,
    },
    {
      productCode: 'PM-PEC-10243',
      sellerId: diya.id,
      title: 'A2 Engineering Drawing Board & Parallel Bar',
      description:
        'Full A2 drafting board with smooth locking parallel ruler, mini-drafter compatibility, and 30/60 set square included. Ideal for Engineering Drawing lab submissions.',
      category: 'Academic',
      subcategory: 'Drawing boards',
      condition: 'Good',
      listingType: 'rent',
      sellingPrice: null,
      negotiable: false,
      rentalPriceDaily: 40,
      rentalPriceWeekly: 220,
      rentalPriceMonthly: 650,
      securityDeposit: 400,
      pickupLocation: 'Mechanical Workshop Courtyard',
      hostelOrDept: 'Kalpana Chawla Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.drawingBoard,
      viewCount: 64,
    },
    {
      productCode: 'PM-PEC-10244',
      sellerId: rohan.id,
      title: 'Matte Charcoal Commuter Campus Bicycle',
      description:
        'Lightweight single-speed commuter cycle with rear carrier, front LED light, and U-lock. Serviced last week at Sector 12 market. Smooth ride from hostels to academic blocks.',
      category: 'Hostel and Lifestyle',
      subcategory: 'Cycles',
      condition: 'Good',
      listingType: 'rent',
      sellingPrice: null,
      negotiable: false,
      rentalPriceDaily: 30,
      rentalPriceWeekly: 160,
      rentalPriceMonthly: 500,
      securityDeposit: 800,
      pickupLocation: 'Shivalik Hostel Cycle Stand',
      hostelOrDept: 'Shivalik Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.bicycle,
      viewCount: 118,
    },
    {
      productCode: 'PM-PEC-10245',
      sellerId: diya.id,
      title: 'Anodized Aluminum Ergonomic Laptop Stand',
      description:
        'Foldable 6-level adjustable aluminum stand supporting 13" to 16" laptops. Great posture and airflow during long coding nights in hostel rooms.',
      category: 'Electronics',
      subcategory: 'Laptops and accessories',
      condition: 'Like New',
      listingType: 'sell',
      sellingPrice: 150,
      negotiable: false,
      rentalPriceDaily: null,
      rentalPriceWeekly: null,
      rentalPriceMonthly: null,
      securityDeposit: 0,
      pickupLocation: 'PEC Market / Student Centre',
      hostelOrDept: 'Kalpana Chawla Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.laptopStand,
      viewCount: 53,
    },
    {
      productCode: 'PM-PEC-10246',
      sellerId: aarav.id,
      title: 'Matte Black Over-Ear Wireless Headphones',
      description:
        'Comfortable memory-foam ear cushions, 35-hour battery life, USB-C charging, and clean studio acoustics for NPTEL lectures and late-night study sessions.',
      category: 'Electronics',
      subcategory: 'Headphones',
      condition: 'Good',
      listingType: 'sell',
      sellingPrice: 350,
      negotiable: true,
      rentalPriceDaily: null,
      rentalPriceWeekly: null,
      rentalPriceMonthly: null,
      securityDeposit: 0,
      pickupLocation: 'CSE Department Atrium',
      hostelOrDept: 'Himalaya Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.headphones,
      viewCount: 71,
    },
    {
      productCode: 'PM-PEC-10247',
      sellerId: rohan.id,
      title: 'Foldable Oak & Steel Hostel Study Table',
      description:
        'Sturdy 90x55 cm foldable study desk with powder-coated steel frame and oak-finish top. Fits easily beside standard PEC hostel beds.',
      category: 'Hostel and Lifestyle',
      subcategory: 'Furniture',
      condition: 'Good',
      listingType: 'sell',
      sellingPrice: 400,
      negotiable: true,
      rentalPriceDaily: null,
      rentalPriceWeekly: null,
      rentalPriceMonthly: null,
      securityDeposit: 0,
      pickupLocation: 'Shivalik Hostel Ground Floor',
      hostelOrDept: 'Shivalik Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.studyTable,
      viewCount: 95,
    },
    {
      productCode: 'PM-PEC-10248',
      sellerId: diya.id,
      title: '75% Wireless Mechanical Keyboard (Tactile)',
      description:
        'Hot-swappable compact 75% mechanical keyboard with dual Bluetooth/2.4GHz wireless and PBT keycaps. Quiet tactile switches suitable for shared hostel rooms.',
      category: 'Electronics',
      subcategory: 'Keyboards',
      condition: 'Like New',
      listingType: 'rent',
      sellingPrice: null,
      negotiable: false,
      rentalPriceDaily: 30,
      rentalPriceWeekly: 170,
      rentalPriceMonthly: 550,
      securityDeposit: 500,
      pickupLocation: 'ECE Department Lab Corridor',
      hostelOrDept: 'Kalpana Chawla Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.keyboard,
      viewCount: 77,
    },
    {
      productCode: 'PM-PEC-10249',
      sellerId: mehak.id,
      title: 'PEC Workshop Cotton Lab Coat (Size M) + Safety Goggles',
      description:
        'Freshly laundered thick 100% cotton white workshop apron required for PEC Central Workshop & Chemistry Lab, paired with clear anti-scratch safety goggles.',
      category: 'Academic',
      subcategory: 'Lab accessories',
      condition: 'Like New',
      listingType: 'both',
      sellingPrice: 180,
      negotiable: false,
      rentalPriceDaily: 15,
      rentalPriceWeekly: 60,
      rentalPriceMonthly: 140,
      securityDeposit: 100,
      pickupLocation: 'PEC Central Workshop Gate',
      hostelOrDept: 'Vindhya Hostel / PIE Dept',
      imageUrl: DEMO_PRODUCT_IMAGES.labCoat,
      viewCount: 68,
    },
    {
      productCode: 'PM-PEC-10250',
      sellerId: kabirB.id,
      title: 'Stainless Steel Digital Vernier Caliper (150mm)',
      description:
        'Precision 0.01mm resolution stainless steel digital vernier caliper with fitted protective foam case and spare CR2032 cell. Great for Mechanical & Production labs.',
      category: 'Academic',
      subcategory: 'Engineering instruments',
      condition: 'Like New',
      listingType: 'rent',
      sellingPrice: null,
      negotiable: false,
      rentalPriceDaily: 35,
      rentalPriceWeekly: 180,
      rentalPriceMonthly: 500,
      securityDeposit: 350,
      pickupLocation: 'Kurukshetra Hostel Common Room',
      hostelOrDept: 'Kurukshetra Hostel / Civil Dept',
      imageUrl: DEMO_PRODUCT_IMAGES.vernierCaliper,
      viewCount: 51,
    },
    {
      productCode: 'PM-PEC-10251',
      sellerId: pranav.id,
      title: 'Raspberry Pi 4 (4GB) + Breadboard & Jumper Kit',
      description:
        'Raspberry Pi 4 Model B with matte aluminum heatsink case, 32GB microSD (Raspberry Pi OS pre-flashed), solderless breadboard, LEDs, and 40-pin jumper bundle for mini-projects.',
      category: 'Electronics',
      subcategory: 'Computer peripherals',
      condition: 'Like New',
      listingType: 'rent',
      sellingPrice: null,
      negotiable: false,
      rentalPriceDaily: 60,
      rentalPriceWeekly: 320,
      rentalPriceMonthly: 950,
      securityDeposit: 1000,
      pickupLocation: 'PEC Innovation & Robotics Lab',
      hostelOrDept: 'Aravali Hostel / CSE Dept',
      imageUrl: DEMO_PRODUCT_IMAGES.raspberryPi,
      viewCount: 104,
    },
    {
      productCode: 'PM-PEC-10252',
      sellerId: harpreet.id,
      title: 'Yonex Carbon-Fiber Badminton Racket + Shuttle Tube',
      description:
        'Light isometric frame strung at 24 lbs tension with fresh grip tape and half tube of feather shuttles. Ready for evening matches at the PEC Indoor Badminton Hall.',
      category: 'Sports and Recreation',
      subcategory: 'Sports equipment',
      condition: 'Good',
      listingType: 'both',
      sellingPrice: 650,
      negotiable: true,
      rentalPriceDaily: 30,
      rentalPriceWeekly: 150,
      rentalPriceMonthly: 420,
      securityDeposit: 300,
      pickupLocation: 'PEC Athletic Ground / Sports Complex',
      hostelOrDept: 'Shivalik Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.badmintonRacket,
      viewCount: 83,
    },
    {
      productCode: 'PM-PEC-10253',
      sellerId: ananya.id,
      title: 'Stainless Steel 1.5L Electric Kettle (Auto Shut-off)',
      description:
        'Clean 1500W stainless steel kettle with concealed heating element and 360° swivel base. Ideal for late-night coffee, tea, and Maggi during PEC end-sem prep.',
      category: 'Hostel and Lifestyle',
      subcategory: 'Kitchen appliances',
      condition: 'Good',
      listingType: 'sell',
      sellingPrice: 320,
      negotiable: true,
      rentalPriceDaily: null,
      rentalPriceWeekly: null,
      rentalPriceMonthly: null,
      securityDeposit: 0,
      pickupLocation: 'Kalpana Chawla Hostel Lobby',
      hostelOrDept: 'Kalpana Chawla Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.electricKettle,
      viewCount: 92,
    },
    {
      productCode: 'PM-PEC-10254',
      sellerId: simran.id,
      title: 'Natural Spruce Dreadnought Acoustic Guitar + Stand',
      description:
        'Well-maintained 41-inch spruce top acoustic guitar with low action, fresh D’Addario bronze strings, and foldable A-frame floor stand. Perfect for PEC Fest & hostel jam nights.',
      category: 'Sports and Recreation',
      subcategory: 'Musical instruments',
      condition: 'Like New',
      listingType: 'rent',
      sellingPrice: null,
      negotiable: false,
      rentalPriceDaily: 50,
      rentalPriceWeekly: 280,
      rentalPriceMonthly: 850,
      securityDeposit: 1000,
      pickupLocation: 'PEC Student Activity Centre (SAC)',
      hostelOrDept: 'Vindhya Hostel / Electrical Dept',
      imageUrl: DEMO_PRODUCT_IMAGES.acousticGuitar,
      viewCount: 112,
    },
    {
      productCode: 'PM-PEC-10255',
      sellerId: pranav.id,
      title: '65W USB-C GaN Multi-Port Fast Laptop Charger + Cable',
      description:
        'Compact 3-port GaN PD charger (2x USB-C + 1x USB-A) with 1.5m braided 100W USB-C cable. Charges MacBook, ThinkPad, or phones simultaneously during library hours.',
      category: 'Electronics',
      subcategory: 'Chargers',
      condition: 'New',
      listingType: 'sell',
      sellingPrice: 550,
      negotiable: false,
      rentalPriceDaily: null,
      rentalPriceWeekly: null,
      rentalPriceMonthly: null,
      securityDeposit: 0,
      pickupLocation: 'PEC Central Library Reading Hall',
      hostelOrDept: 'Aravali Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.ganCharger,
      viewCount: 61,
    },
    {
      productCode: 'PM-PEC-10256',
      sellerId: kabirB.id,
      title: 'B.S. Grewal Higher Engineering Mathematics (44th Ed.)',
      description:
        'The standard PEC Chandigarh semester 1–4 engineering mathematics bible covering Laplace transforms, Fourier series, matrices, and PDEs. Crisp binding, no missing pages.',
      category: 'Academic',
      subcategory: 'Textbooks',
      condition: 'Good',
      listingType: 'sell',
      sellingPrice: 290,
      negotiable: true,
      rentalPriceDaily: null,
      rentalPriceWeekly: null,
      rentalPriceMonthly: null,
      securityDeposit: 0,
      pickupLocation: 'PEC Market Photocopy Shop',
      hostelOrDept: 'Kurukshetra Hostel',
      imageUrl: DEMO_PRODUCT_IMAGES.bsGrewal,
      viewCount: 126,
    },
  ];

  const insertedProducts: (typeof products.$inferSelect)[] = [];

  for (const item of demoProducts) {
    const [existingProd] = await db
      .select()
      .from(products)
      .where(eq(products.productCode, item.productCode))
      .limit(1);

    if (existingProd) {
      insertedProducts.push(existingProd);
      continue;
    }

    const rawQrPayload = `PINGME:PROD:${item.productCode}`;
    const qrHash = hashQrToken(rawQrPayload);

    const [created] = await db
      .insert(products)
      .values({
        productCode: item.productCode,
        sellerId: item.sellerId,
        title: item.title,
        description: item.description,
        category: item.category,
        subcategory: item.subcategory,
        condition: item.condition,
        listingType: item.listingType,
        sellingPrice: item.sellingPrice,
        negotiable: item.negotiable,
        rentalPriceDaily: item.rentalPriceDaily,
        rentalPriceWeekly: item.rentalPriceWeekly,
        rentalPriceMonthly: item.rentalPriceMonthly,
        securityDeposit: item.securityDeposit,
        pickupLocation: item.pickupLocation,
        hostelOrDept: item.hostelOrDept,
        availabilityStatus: 'Available',
        qrTokenHash: qrHash,
        viewCount: item.viewCount,
        isDemo: true,
      })
      .returning();

    insertedProducts.push(created);

    await db.insert(productImages).values({
      productId: created.id,
      imageUrl: item.imageUrl,
      sortOrder: 0,
    });

    await db.insert(qrTokens).values({
      productId: created.id,
      tokenHash: qrHash,
      rawCode: rawQrPayload,
      tokenType: 'product_discovery',
      issuedBy: item.sellerId,
    });
  }

  // 4. Seed Sample Transactions & Reviews only if TXN-PEC-8801 doesn't exist yet
  const [existingTxn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.transactionCode, 'TXN-PEC-8801'))
    .limit(1);

  if (!existingTxn && insertedProducts.length >= 2) {
    const textbook = insertedProducts[0];
    const calc = insertedProducts[1];

    const [completedTxn] = await db
      .insert(transactions)
      .values({
        transactionCode: 'TXN-PEC-8801',
        productId: textbook.id,
        buyerId: diya.id,
        sellerId: aarav.id,
        transactionType: 'buy',
        totalAmount: 250,
        depositAmount: 0,
        notes: 'Picked up after Mathematics lecture at LTC.',
        transactionStatus: 'Completed',
        collectedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        returnedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      })
      .returning();

    await db.insert(reviews).values({
      transactionId: completedTxn.id,
      reviewerId: diya.id,
      reviewedUserId: aarav.id,
      rating: 5,
      comment:
        'Super smooth QR handover at LTC! Book was in crisp condition just as listed.',
    });

    const start = new Date();
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);
    await db.insert(transactions).values({
      transactionCode: 'TXN-PEC-8802',
      productId: calc.id,
      buyerId: diya.id,
      sellerId: aarav.id,
      transactionType: 'rent',
      bookingStart: start,
      bookingEnd: end,
      totalAmount: 75,
      depositAmount: 300,
      notes: 'Need for Signals & Systems sessional exam.',
      transactionStatus: 'Booked',
    });

    await db.insert(notifications).values([
      {
        userId: aarav.id,
        title: 'Rental Booking Confirmed',
        message:
          'Diya Verma booked your Casio FX-991EX Scientific Calculator (3 days). Generate a handover QR when meeting at LTC.',
        notificationType: 'booking',
        linkUrl: '/app/transactions',
      },
      {
        userId: diya.id,
        title: 'Ready for QR Collection',
        message:
          'Your 3-day rental for Casio FX-991EX Scientific Calculator is Booked. Scan Aarav’s handover QR at pickup.',
        notificationType: 'qr_handover',
        linkUrl: '/app/qr-centre',
      },
    ]);

    await db.insert(messages).values({
      senderId: diya.id,
      receiverId: aarav.id,
      productId: calc.id,
      messageText:
        'Hi Aarav! Can we meet outside LTC at 2 PM today for the calculator QR handover?',
    });
  }

  await seedEateries();
  await seedMonetization();
}

async function seedEateries(): Promise<void> {
  const [eateryMarker] = await db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.slug, 'student-centre-canteen'))
    .limit(1);

  if (eateryMarker) {
    return;
  }

  const shopPasswordHash = await hashPassword('pecshop123');
  const ownerSeed = [
    {
      studentId: 'SHOP-VERKA',
      fullName: 'Verka Booth Manager',
      institutionalEmail: 'verka.booth@pec.edu.in',
      passwordHash: shopPasswordHash,
      department: 'Campus Eatery Partner',
      academicYear: 'Authorized Vendor',
      role: 'shop_owner',
      verificationStatus: 'verified',
      hostelBlock: 'PEC Market Courtyard',
      bio: 'Official manager for Verka Booth & Snacks near PEC Central Library.',
    },
    {
      studentId: 'SHOP-NESCAFE',
      fullName: 'Nescafe Corner Manager',
      institutionalEmail: 'nescafe.corner@pec.edu.in',
      passwordHash: shopPasswordHash,
      department: 'Campus Eatery Partner',
      academicYear: 'Authorized Vendor',
      role: 'shop_owner',
      verificationStatus: 'verified',
      hostelBlock: 'LTC Courtyard',
      bio: 'Official manager for Nescafe Campus Corner at Lecture Theatre Complex.',
    },
    {
      studentId: 'SHOP-CENTRE',
      fullName: 'Student Centre Canteen Manager',
      institutionalEmail: 'student.centre@pec.edu.in',
      passwordHash: shopPasswordHash,
      department: 'Campus Eatery Partner',
      academicYear: 'Authorized Vendor',
      role: 'shop_owner',
      verificationStatus: 'verified',
      hostelBlock: 'PEC Student Centre',
      bio: 'Official manager for PEC Student Centre Canteen & Juice Bar.',
    },
  ];

  const ownerByCode = new Map<string, typeof profiles.$inferSelect>();
  for (const owner of ownerSeed) {
    await db
      .insert(profiles)
      .values(owner)
      .onConflictDoNothing({ target: profiles.studentId });

    const [row] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.studentId, owner.studentId))
      .limit(1);
    if (row) ownerByCode.set(owner.studentId, row);
  }

  const verkaOwner = ownerByCode.get('SHOP-VERKA')!;
  const nescafeOwner = ownerByCode.get('SHOP-NESCAFE')!;
  const centreOwner = ownerByCode.get('SHOP-CENTRE')!;

  const shopConfigs = [
    {
      slug: 'verka-booth-snacks',
      name: 'Verka Booth & Snacks',
      description:
        'Campus favourite right beside Central Library for hot samosas, grilled sandwiches, chilled Verka lassi, masala chai, and quick rajma bowls.',
      location: 'Near PEC Central Library & Market',
      imageUrl: DEMO_EATERY_IMAGES.verkaShop,
      openingHours: '8:00 AM – 8:00 PM',
      prepTime: '5–10 mins',
      paymentProcessNote:
        'Pay via UPI QR or cash directly at the Verka Booth counter when collecting your takeaway parcel.',
      ownerId: verkaOwner.id,
      items: [
        {
          name: 'Crispy Aloo Samosa (2 pcs)',
          description:
            'Golden flaky Punjabi samosas served hot with tamarind and mint-coriander chutneys.',
          price: 30,
          category: 'Snacks',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Grilled Paneer Tikka Sandwich',
          description:
            'Toasted jumbo bread stuffed with spiced paneer cubes, capsicum, onions, and mint mayo.',
          price: 65,
          category: 'Snacks',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Verka Sweet Lassi (300 ml)',
          description:
            'Chilled creamy Verka dairy sweet lassi cup served fresh from the booth chiller.',
          price: 35,
          category: 'Beverages',
          imageUrl: DEMO_EATERY_IMAGES.beveragesCoffee,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Kullad Masala Chai',
          description:
            'Strong cardamom-ginger brewed tea poured piping hot into an earthen cup.',
          price: 20,
          category: 'Beverages',
          imageUrl: DEMO_EATERY_IMAGES.beveragesCoffee,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Punjabi Rajma Chawal Bowl',
          description:
            'Slow-cooked spiced red kidney bean curry over steamed basmati rice with pickled onions.',
          price: 85,
          category: 'Meals',
          imageUrl: DEMO_EATERY_IMAGES.mealsThali,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Verka Mango Flavoured Milk (200 ml)',
          description:
            'Ready-to-grab chilled Alphonso mango milk bottle for quick breaks between labs.',
          price: 30,
          category: 'Other items',
          imageUrl: DEMO_EATERY_IMAGES.beveragesCoffee,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
      ],
    },
    {
      slug: 'nescafe-campus-corner',
      name: 'Nescafe Campus Corner',
      description:
        'Open-air coffee kiosk outside the Lecture Theatre Complex serving signature cold coffee, hot Maggi bowls, club sandwiches, and brownies.',
      location: 'Lecture Theatre Complex (LTC) Courtyard',
      imageUrl: DEMO_EATERY_IMAGES.nescafeShop,
      openingHours: '8:30 AM – 9:30 PM',
      prepTime: '8–12 mins',
      paymentProcessNote:
        'Show your PingME Order ID at the LTC Nescafe pickup window and complete UPI/cash payment at collection.',
      ownerId: nescafeOwner.id,
      items: [
        {
          name: 'Classic Nescafe Cold Coffee',
          description:
            'Whisked frothy iced coffee blended with chilled milk and cocoa drizzle.',
          price: 55,
          category: 'Beverages',
          imageUrl: DEMO_EATERY_IMAGES.beveragesCoffee,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Iced Americano Espresso',
          description:
            'Double shot of roasted Nescafe black coffee over crystal ice, unsweetened.',
          price: 60,
          category: 'Beverages',
          imageUrl: DEMO_EATERY_IMAGES.beveragesCoffee,
          isAvailable: true,
          dietaryLabel: 'Vegan',
        },
        {
          name: 'Double Masala Cheese Maggi',
          description:
            'Campus classic Maggi noodles tossed with veggies, butter, and melted cheddar slice.',
          price: 55,
          category: 'Snacks',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Peri-Peri Chicken Club Sandwich',
          description:
            'Triple-layer toasted sandwich with spiced grilled chicken strips, lettuce, and peri-peri dip.',
          price: 95,
          category: 'Snacks',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: true,
          dietaryLabel: 'Non-Veg',
        },
        {
          name: 'Cheese Corn Toastie',
          description:
            'Crisp buttered panini filled with sweet corn kernels, oregano, and mozzarella.',
          price: 65,
          category: 'Meals',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Dark Chocolate Walnut Brownie',
          description:
            'Warm fudgy cocoa brownie slice topped with roasted walnuts.',
          price: 50,
          category: 'Other items',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: true,
          dietaryLabel: 'Egg',
        },
      ],
    },
    {
      slug: 'student-centre-canteen',
      name: 'Student Centre Canteen & Juice Bar',
      description:
        'Main PEC Student Centre canteen offering wholesome North Indian thalis, chole bhature, Indo-Chinese bowls, and fresh citrus coolers.',
      location: 'PEC Student Centre, Ground Floor',
      imageUrl: DEMO_EATERY_IMAGES.studentCentreShop,
      openingHours: '9:00 AM – 8:30 PM',
      prepTime: '12–18 mins',
      paymentProcessNote:
        'Present your PingME Order ID at the Student Centre billing counter to pay via UPI or cash before pickup.',
      ownerId: centreOwner.id,
      items: [
        {
          name: 'PEC Special North Indian Thali',
          description:
            'Dal makhani, kadai paneer, jeera rice, 3 butter rotis, boondi raita, and salad.',
          price: 110,
          category: 'Meals',
          imageUrl: DEMO_EATERY_IMAGES.mealsThali,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Chole Bhature Plate (2 pcs)',
          description:
            'Fluffy golden bhaturas served with spiced Amritsari chole and tangy amla pickle.',
          price: 80,
          category: 'Meals',
          imageUrl: DEMO_EATERY_IMAGES.mealsThali,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Egg Fried Rice & Manchurian Bowl',
          description:
            'Wok-tossed egg fried rice paired with crispy veg Manchurian balls in garlic soy gravy.',
          price: 105,
          category: 'Meals',
          imageUrl: DEMO_EATERY_IMAGES.mealsThali,
          isAvailable: true,
          dietaryLabel: 'Egg',
        },
        {
          name: 'Fresh Mint Nimbu Soda',
          description:
            'Sparkling lemon cooler muddled with garden mint leaves and black salt.',
          price: 35,
          category: 'Beverages',
          imageUrl: DEMO_EATERY_IMAGES.beveragesCoffee,
          isAvailable: true,
          dietaryLabel: 'Vegan',
        },
        {
          name: 'Crispy Vegetable Spring Rolls',
          description:
            '4 crunchy julienne-vegetable rolls served with sweet chilli garlic sauce.',
          price: 60,
          category: 'Snacks',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: true,
          dietaryLabel: 'Veg',
        },
        {
          name: 'Fresh Seasonal Fruit Chaat Cup',
          description:
            'Chilled diced papaya, apple, pineapple, and pomegranate tossed in light chaat masala.',
          price: 45,
          category: 'Other items',
          imageUrl: DEMO_EATERY_IMAGES.snacksCombo,
          isAvailable: false,
          dietaryLabel: 'Vegan',
        },
      ],
    },
  ];

  const createdShops = new Map<string, typeof shops.$inferSelect>();
  const createdMenuByShop = new Map<string, (typeof menuItems.$inferSelect)[]>();

  for (const cfg of shopConfigs) {
    await db
      .insert(shops)
      .values({
        slug: cfg.slug,
        name: cfg.name,
        description: cfg.description,
        location: cfg.location,
        imageUrl: cfg.imageUrl,
        openingHours: cfg.openingHours,
        prepTime: cfg.prepTime,
        paymentProcessNote: cfg.paymentProcessNote,
        isActive: true,
        ownerId: cfg.ownerId,
      })
      .onConflictDoNothing({ target: shops.slug });

    const [shopRow] = await db
      .select()
      .from(shops)
      .where(eq(shops.slug, cfg.slug))
      .limit(1);
    if (!shopRow) continue;
    createdShops.set(cfg.slug, shopRow);

    const existingItems = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.shopId, shopRow.id));

    if (existingItems.length === 0) {
      const insertedItems = await db
        .insert(menuItems)
        .values(
          cfg.items.map((item) => ({
            shopId: shopRow.id,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            imageUrl: item.imageUrl,
            isAvailable: item.isAvailable,
            dietaryLabel: item.dietaryLabel,
          }))
        )
        .returning();
      createdMenuByShop.set(cfg.slug, insertedItems);
    } else {
      createdMenuByShop.set(cfg.slug, existingItems);
    }
  }

  // Seed historical Collected orders + verified shop reviews so ratings populate accurately
  const [aarav] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.studentId, '22103011'))
    .limit(1);
  const [diya] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.studentId, '22104028'))
    .limit(1);
  const [pranav] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.studentId, '23103067'))
    .limit(1);

  if (!aarav || !diya || !pranav) return;

  const verkaShop = createdShops.get('verka-booth-snacks');
  const nescafeShop = createdShops.get('nescafe-campus-corner');
  const centreShop = createdShops.get('student-centre-canteen');

  const verkaMenu = createdMenuByShop.get('verka-booth-snacks') || [];
  const nescafeMenu = createdMenuByShop.get('nescafe-campus-corner') || [];
  const centreMenu = createdMenuByShop.get('student-centre-canteen') || [];

  const [existingOrd] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderCode, 'ORD-PEC-3101'))
    .limit(1);

  if (!existingOrd && verkaShop && nescafeShop && centreShop) {
    const seededOrdersData = [
      {
        orderCode: 'ORD-PEC-3101',
        studentId: diya.id,
        shopId: verkaShop.id,
        menu: verkaMenu,
        indices: [0, 2],
        rating: 5,
        comment: 'Hot crispy samosas and chilled Verka lassi ready right on time between lectures.',
      },
      {
        orderCode: 'ORD-PEC-3102',
        studentId: pranav.id,
        shopId: verkaShop.id,
        menu: verkaMenu,
        indices: [1, 3],
        rating: 4,
        comment: 'Paneer sandwich was well grilled and masala chai hit the spot.',
      },
      {
        orderCode: 'ORD-PEC-3103',
        studentId: aarav.id,
        shopId: nescafeShop.id,
        menu: nescafeMenu,
        indices: [0, 2],
        rating: 5,
        comment: 'Zero queue wait at LTC break—cold coffee and cheese Maggi were packed neatly.',
      },
      {
        orderCode: 'ORD-PEC-3104',
        studentId: diya.id,
        shopId: centreShop.id,
        menu: centreMenu,
        indices: [0, 3],
        rating: 5,
        comment: 'Filling North Indian thali with fresh mint soda. Super smooth pickup at Student Centre.',
      },
    ];

    for (const s of seededOrdersData) {
      const picked = s.indices
        .map((idx) => s.menu[idx])
        .filter(Boolean)
        .map((m) => ({
          menuItemId: m.id,
          name: m.name,
          price: m.price,
          quantity: 1,
          subtotal: m.price,
          dietaryLabel: m.dietaryLabel,
        }));
      if (picked.length === 0) continue;

      const totalAmount = picked.reduce((acc, i) => acc + i.subtotal, 0);
      const [ord] = await db
        .insert(orders)
        .values({
          orderCode: s.orderCode,
          studentId: s.studentId,
          shopId: s.shopId,
          items: picked,
          totalAmount,
          status: 'Collected',
          pickupConfirmedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        })
        .returning();

      await db.insert(shopReviews).values({
        shopId: s.shopId,
        studentId: s.studentId,
        orderId: ord.id,
        rating: s.rating,
        comment: s.comment,
        moderationStatus: 'visible',
      });
    }

    // Recompute cached shop ratings & review counts
    for (const shop of [verkaShop, nescafeShop, centreShop]) {
      const revs = await db
        .select()
        .from(shopReviews)
        .where(eq(shopReviews.shopId, shop.id));
      const count = revs.length;
      const avg =
        count > 0
          ? Number(
              (revs.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1)
            )
          : 0;
      await db
        .update(shops)
        .set({ averageRating: avg, reviewCount: count })
        .where(eq(shops.id, shop.id));
    }
  }
}

async function seedMonetization(): Promise<void> {
  // 1. Ensure default platform settings exist
  const [existingConfig] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'default'))
    .limit(1);

  if (!existingConfig) {
    await db
      .insert(platformSettings)
      .values({
        key: 'default',
        boostBasicPrice: 20,
        boostBasicHours: 72,
        boostStandardPrice: 35,
        boostStandardHours: 168,
        boostPremiumPrice: 50,
        boostPremiumHours: 336,
        premiumPrice: 199,
        premiumDurationDays: 30,
        referralCommissionPct: 5,
        referralMinOrderAmount: 100,
        referralDisputeWindowHours: 24,
      })
      .onConflictDoNothing({ target: platformSettings.key });
  }

  // 2. Backfill deterministic referral codes for any existing profiles without one
  const missingRefProfiles = await db
    .select()
    .from(profiles)
    .where(isNull(profiles.referralCode));

  for (const p of missingRefProfiles) {
    const clean = p.studentId.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    await db
      .update(profiles)
      .set({ referralCode: `PEC-${clean}` })
      .where(eq(profiles.id, p.id));
  }

  // 3. Idempotent monetization sample marker check
  const [monetizationMarker] = await db
    .select({ id: paymentTransactions.id })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.idempotencyKey, 'seed-monetization-v1'))
    .limit(1);

  if (monetizationMarker) return;

  const [aarav] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.studentId, '22103011'))
    .limit(1);
  const [pranav] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.studentId, '23103067'))
    .limit(1);
  const [mehak] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.studentId, '23108019'))
    .limit(1);
  const [diya] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.studentId, '22104028'))
    .limit(1);

  const [calcProd] = await db
    .select()
    .from(products)
    .where(eq(products.productCode, 'PM-PEC-10242'))
    .limit(1);
  const [piProd] = await db
    .select()
    .from(products)
    .where(eq(products.productCode, 'PM-PEC-10251'))
    .limit(1);
  const [headphonesProd] = await db
    .select()
    .from(products)
    .where(eq(products.productCode, 'PM-PEC-10246'))
    .limit(1);

  if (!aarav || !pranav || !mehak || !diya) return;

  const now = Date.now();

  // Seed Active Premium Membership for Aarav (22103011) so demo evaluator can view full Analytics immediately
  const subStart = new Date(now - 1000 * 60 * 60 * 24 * 6);
  const subExpiry = new Date(now + 1000 * 60 * 60 * 24 * 24);
  const [premSub] = await db
    .insert(premiumSubscriptions)
    .values({
      userId: aarav.id,
      planPrice: 199,
      durationDays: 30,
      startDate: subStart,
      expiryDate: subExpiry,
      paymentStatus: 'paid',
      subscriptionStatus: 'active',
    })
    .returning();

  const [premPay] = await db
    .insert(paymentTransactions)
    .values({
      userId: aarav.id,
      purpose: 'premium_membership',
      referenceId: premSub.id,
      amount: 199,
      currency: 'INR',
      gateway: 'sandbox',
      gatewayOrderId: 'sandbox_ord_SEED_PREM_01',
      gatewayPaymentId: 'sandbox_pay_SEED_PREM_01',
      idempotencyKey: 'seed-monetization-v1',
      paymentMethod: 'upi',
      status: 'succeeded',
      metadata: { seeded: true, plan: 'monthly_premium' },
    })
    .returning();

  await db
    .update(premiumSubscriptions)
    .set({ paymentTransactionId: premPay.id })
    .where(eq(premiumSubscriptions.id, premSub.id));

  await db
    .update(profiles)
    .set({ isPremium: true })
    .where(eq(profiles.id, aarav.id));

  // Seed 2 Active Boosted Listings (Calculator Standard Boost ₹35 & Raspberry Pi Premium Boost ₹50)
  if (calcProd) {
    const [promo1] = await db
      .insert(listingPromotions)
      .values({
        listingId: calcProd.id,
        sellerId: aarav.id,
        packageType: 'standard',
        amount: 35,
        startTime: new Date(now - 1000 * 60 * 60 * 12),
        expiryTime: new Date(now + 1000 * 60 * 60 * 156),
        paymentStatus: 'paid',
        promotionStatus: 'active',
      })
      .returning();

    const [pay1] = await db
      .insert(paymentTransactions)
      .values({
        userId: aarav.id,
        purpose: 'listing_boost',
        referenceId: promo1.id,
        amount: 35,
        currency: 'INR',
        gateway: 'sandbox',
        gatewayOrderId: 'sandbox_ord_SEED_BOOST_01',
        gatewayPaymentId: 'sandbox_pay_SEED_BOOST_01',
        idempotencyKey: 'seed-monetization-boost-01',
        paymentMethod: 'upi',
        status: 'succeeded',
      })
      .returning();

    await db
      .update(listingPromotions)
      .set({ paymentTransactionId: pay1.id })
      .where(eq(listingPromotions.id, promo1.id));
  }

  if (piProd) {
    const [promo2] = await db
      .insert(listingPromotions)
      .values({
        listingId: piProd.id,
        sellerId: pranav.id,
        packageType: 'premium',
        amount: 50,
        startTime: new Date(now - 1000 * 60 * 60 * 6),
        expiryTime: new Date(now + 1000 * 60 * 60 * 330),
        paymentStatus: 'paid',
        promotionStatus: 'active',
      })
      .returning();

    const [pay2] = await db
      .insert(paymentTransactions)
      .values({
        userId: pranav.id,
        purpose: 'listing_boost',
        referenceId: promo2.id,
        amount: 50,
        currency: 'INR',
        gateway: 'sandbox',
        gatewayOrderId: 'sandbox_ord_SEED_BOOST_02',
        gatewayPaymentId: 'sandbox_pay_SEED_BOOST_02',
        idempotencyKey: 'seed-monetization-boost-02',
        paymentMethod: 'card',
        status: 'succeeded',
      })
      .returning();

    await db
      .update(listingPromotions)
      .set({ paymentTransactionId: pay2.id })
      .where(eq(listingPromotions.id, promo2.id));
  }

  // Seed historical Product View Events for Aarav's listings so Premium Analytics trend charts look meaningful
  const aaravProds = [calcProd, headphonesProd].filter(Boolean) as (typeof products.$inferSelect)[];
  if (aaravProds.length > 0) {
    const viewEventsBatch: Array<{
      productId: string;
      sellerId: string;
      visitorKey: string;
      viewedAt: Date;
    }> = [];
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const viewsPerDay = 3 + ((dayOffset * 5) % 7);
      for (let v = 0; v < viewsPerDay; v++) {
        const targetProd = aaravProds[(dayOffset + v) % aaravProds.length];
        viewEventsBatch.push({
          productId: targetProd.id,
          sellerId: aarav.id,
          visitorKey: `pec-visitor-${(dayOffset * 3 + v) % 19}`,
          viewedAt: new Date(now - dayOffset * 86400000 - v * 3600000),
        });
      }
    }
    await db.insert(productViewEvents).values(viewEventsBatch);
  }

  // Seed Referrals & Commission Ledger (Aarav referred Pranav & Mehak; Pranav completed an eligible transaction)
  const aaravCode = `PEC-${aarav.studentId}`;
  await db
    .update(profiles)
    .set({ referredBy: aarav.id })
    .where(eq(profiles.id, pranav.id));
  await db
    .update(profiles)
    .set({ referredBy: aarav.id })
    .where(eq(profiles.id, mehak.id));

  const [ref1] = await db
    .insert(referrals)
    .values({
      referrerId: aarav.id,
      referredUserId: pranav.id,
      referralCode: aaravCode,
      status: 'verified',
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(referrals)
    .values({
      referrerId: aarav.id,
      referredUserId: mehak.id,
      referralCode: aaravCode,
      status: 'verified',
    })
    .onConflictDoNothing();

  if (ref1 && headphonesProd) {
    const [refPurchase] = await db
      .insert(transactions)
      .values({
        transactionCode: 'TXN-PEC-8803',
        productId: headphonesProd.id,
        buyerId: pranav.id,
        sellerId: diya.id,
        transactionType: 'buy',
        totalAmount: 350,
        depositAmount: 0,
        notes: 'Completed campus headphone exchange via QR.',
        transactionStatus: 'Completed',
        collectedAt: new Date(now - 1000 * 60 * 60 * 36),
        returnedAt: new Date(now - 1000 * 60 * 60 * 36),
      })
      .onConflictDoNothing()
      .returning();

    if (refPurchase) {
      await db.insert(referralTransactions).values({
        referralId: ref1.id,
        referrerId: aarav.id,
        referredUserId: pranav.id,
        referralCode: aaravCode,
        transactionId: refPurchase.id,
        eligibleAmount: 350,
        commissionRate: 5,
        commissionAmount: 18,
        rewardStatus: 'credited',
        eligibleAt: new Date(now - 1000 * 60 * 60 * 12),
        creditedAt: new Date(now - 1000 * 60 * 60 * 12),
      });
    }
  }
}

