// Central company / legal info and footer navigation for Ono-Fix.
// Emails are temporary and can be changed later.
export const COMPANY = {
  brand: 'Ono-Fix',
  legalName: 'Nexus Security Solutions LLC',
  owner: 'Zhovtiak Leonid',
  address: '9701 Dee Rd, Niles, IL 60714',
  emails: ['Nexus.ss.llc@gmail.com', 'finscan@finscan.store'],
  operatedBy: 'Ono-Fix is a service operated by Nexus Security Solutions LLC.',
};

export type FooterLink = { label: string; route: string };

export const FOOTER_LINKS: FooterLink[] = [
  { label: 'About Ono-Fix', route: '/about' },
  { label: 'How It Works', route: '/how-it-works' },
  { label: 'Pricing', route: '/pricing' },
  { label: 'FAQ', route: '/help-center' },
  { label: 'Contact Us', route: '/contact' },
  { label: 'Privacy Policy', route: '/privacy' },
  { label: 'Terms of Service', route: '/terms' },
];

// How It Works illustrations (generated assets)
export const HOW_IMAGES = {
  clientPhoto: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/f2ea13b96b2dae73a81d9c46409155a274212b8978f34ac069dff45e40e3ffb5.png',
  clientMatch: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/c8cf43461d5dfdccb92f1e620a02d5dca8d790fb7345b83eeb6c2540cbf332b4.png',
  clientBook: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/289a60c687838e6c4d026bed909b8f95ad8d4054416750be0d34c390f2919354.png',
  clientPay: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/4c6629c8906bdeb1e9fb7cb99887ce6400d5aae988e1549b2111f74d007b5df6.png',
  proProfile: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/3e04030204085f77e17c80b35e94f811252a81aa2c5d10eaebc8454b202ff322.png',
  proRate: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/b959abafd4a179e272f4d764ab18fcea5e1f2f37ba72eb555e03e160a2b30bc4.png',
  proJobs: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/49b3224eb103d560250463197bc940c4bb4b43c6a2f6f42ff5ab9f38154d6b99.png',
  proPaid: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/486049010335d6241bb6d486a05118c88bf9f8e79c0602c80da8f11fd3d21db1.png',
};

// Optional walkthrough videos — leave empty until provided by the owner.
export const HOW_VIDEOS = {
  client: '',
  provider: '',
};
