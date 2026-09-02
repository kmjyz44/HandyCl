import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

const EFFECTIVE_DATE = 'June 1, 2026';
const LAST_UPDATED = 'June 15, 2026';

type Para = string | { bullets: string[] };
type Section = { title: string; body: Para[] };

const SECTIONS: Section[] = [
  { title: '1. About Ono-Fix', body: [
    'Ono-Fix is a technology platform designed to connect Customers who need home services with independent Service Providers who offer those services.',
    'The Platform may allow Customers to:',
    { bullets: ['submit service requests;', 'upload photographs;', 'describe problems;', 'receive service information;', 'communicate with Service Providers;', 'schedule services;', 'review job information;', 'approve additional work;', 'manage payments;', 'review completed work;', 'communicate regarding disputes.'] },
    'The Platform may also allow Service Providers to:',
    { bullets: ['receive and review service requests;', 'accept jobs;', 'communicate with Customers;', 'provide services;', 'record labor time;', 'document materials;', 'submit Change Orders;', 'document completion;', 'receive payment.'] },
    'Ono-Fix is primarily a technology and marketplace platform and is not itself the Service Provider performing the physical home repair work unless expressly stated otherwise for a particular service.',
  ]},
  { title: '2. Eligibility', body: [
    'You must provide accurate and current information when creating an account.',
    'You may not use Ono-Fix if you are legally prohibited from doing so.',
    'If you create an account on behalf of a business, you represent that you have authority to act for that business.',
  ]},
  { title: '3. Accounts', body: [
    'Users are responsible for maintaining the security of their account credentials.',
    'You agree not to:',
    { bullets: ['share your account with another person;', 'impersonate another person or business;', 'provide false information;', "use another user's account;", 'allow unauthorized individuals to perform jobs under your account.'] },
    'You are responsible for activity occurring through your account unless caused by unauthorized access that was not reasonably within your control.',
    'Ono-Fix may suspend or terminate accounts that violate these Terms.',
  ]},
  { title: '4. Customers', body: [
    'Customers may use Ono-Fix to request home services and communicate with Service Providers.',
    'Customer agrees to provide accurate information about:',
    { bullets: ['the property;', 'the requested service;', 'photographs;', 'known problems;', 'access requirements;', 'known hazards;', 'special instructions.'] },
    'Customers should not intentionally provide misleading information about the condition of the property or requested work.',
  ]},
  { title: '5. Service Providers', body: [
    'Service Providers using Ono-Fix are responsible for performing the services they accept.',
    'A Service Provider represents that the Provider:',
    { bullets: ['has the appropriate skills and experience for the services offered;', 'will comply with applicable laws and codes;', 'will maintain licenses and permits required for the work;', 'will maintain legally required insurance;', 'will accurately record labor time;', 'will accurately report materials;', 'will communicate material problems;', 'will not intentionally charge for unauthorized work.'] },
    'Where a specific trade requires a state or local license, registration, permit, or other authorization, the Service Provider is responsible for obtaining and maintaining it.',
    'Ono-Fix does not replace any license, permit, registration, insurance, or legal requirement applicable to a Service Provider.',
  ]},
  { title: '6. Independent Service Providers', body: [
    'Unless expressly stated otherwise, Service Providers using Ono-Fix are independent businesses or independent contractors and are not employees of Ono-Fix.',
    "The Service Provider is responsible for the manner and means of performing the services, subject to the agreed Scope of Work, applicable law, and the Customer's reasonable property-access requirements.",
    'Nothing in these Terms creates an employment relationship, partnership, joint venture, franchise, or agency relationship between Ono-Fix and a Service Provider unless expressly agreed in writing.',
    'Service Providers are responsible for their own:',
    { bullets: ['taxes;', 'licenses;', 'permits;', 'insurance;', 'tools;', 'equipment;', 'workers;', 'business expenses;', 'legal compliance.'] },
  ]},
  { title: '7. How a Job Works', body: [
    'A typical Ono-Fix transaction may work as follows:',
    { bullets: ['Customer submits a service request.', 'Customer may provide photographs and a description.', 'Service Providers may review the request.', 'A Service Provider may accept the job.', 'Ono-Fix creates a Job Agreement / Work Order.', 'Customer and Service Provider review the job details.', 'Required approvals are obtained.', 'Service Provider performs the work.', 'Additional work may be documented through a Change Order.', 'Service Provider completes the job.', 'Final labor and material charges are calculated.', 'Customer makes the applicable payment.', 'The job is closed.'] },
    'The exact process may vary depending on the service, location, payment method, and applicable law.',
  ]},
  { title: '8. Job Agreement / Work Order', body: [
    'Each individual job may have a separate Job Agreement / Work Order.',
    'The Job Agreement is intended to document the specific agreement between the Customer and Service Provider for that job. It may include:',
    { bullets: ['Customer;', 'Service Provider;', 'service address;', 'Scope of Work;', 'hourly rate;', 'estimated time;', 'materials;', 'applicable charges;', 'payment method;', 'scheduled date;', 'estimated completion;', 'Change Orders;', 'completion information.'] },
    'The Job Agreement controls the specific terms of the individual job, while these Terms of Use govern the general use of the Ono-Fix Platform.',
  ]},
  { title: '9. Hourly Services', body: [
    'Many Ono-Fix services are performed on an hourly basis.',
    'The exact amount of time required to complete a repair may not be known before work begins.',
    'The applicable Job Agreement will identify the applicable hourly rate (e.g., a first-hour rate and a rate for each additional hour).',
    'Unless a fixed-price agreement is expressly stated, the Customer is responsible for the applicable hourly charges for the actual authorized time worked.',
  ]},
  { title: '10. Estimates', body: [
    'A Provider may provide an estimated number of hours before work begins. An estimate may be based on photographs, the Customer description, prior experience, and information available before inspection.',
    'An estimate of time is not a guarantee of the actual time required unless expressly identified as a fixed-price or guaranteed arrangement. Unexpected conditions may cause the actual time required to be higher or lower.',
  ]},
  { title: '11. Materials and Parts', body: [
    'The materials required for a repair may not be known until the Service Provider inspects the problem. For example, a Customer may request a faucet repair, but the Provider may discover that a replacement cartridge, supply line, valve, or other part is required.',
    'When materials are required, the Provider should communicate the expected material cost to the Customer when reasonably practical. The Customer may be responsible for applicable material costs that are properly authorized or otherwise permitted under the applicable Job Agreement and law.',
    'The Platform may allow the Provider to upload material description, quantity, purchase price, receipt, photograph, or other supporting information. Providers must not intentionally inflate, falsify, or misrepresent material costs.',
  ]},
  { title: '12. Additional Work', body: [
    'A Service Provider may discover additional problems after work begins. When additional work is requested or reasonably necessary, the Provider should explain what additional work is needed, why it is needed, and the expected additional labor, materials, and cost.',
    'When reasonably practical, additional work should be documented through an Ono-Fix Change Order. The Provider should not materially increase the Customer\u2019s charges without Customer approval, except where applicable law permits otherwise.',
  ]},
  { title: '13. Change Orders', body: [
    'A Change Order may include the original job price or estimate, additional work, additional labor, additional materials, additional charges, and the revised estimated or agreed amount.',
    'Customer may approve or decline a Change Order through the Platform. Once approved, the Change Order becomes part of the job record.',
    'The original Job Agreement should not be silently edited after acceptance. Ono-Fix may retain the original version and all subsequent Change Orders.',
  ]},
  { title: '14. Final Labor Charges', body: [
    'For hourly work, final labor charges may be calculated based on the applicable hourly rate and actual authorized time worked. For example, at $54/hour for 4.5 authorized hours, the labor charge would be 4.5 \u00d7 $54 = $243.',
    'If applicable, approved material costs and other disclosed charges may then be added. The final amount may therefore differ from an initial estimate.',
  ]},
  { title: '15. Payment', body: [
    'Customers agree to pay amounts properly due under the applicable Job Agreement. Available payment methods may include Ono-Fix supported payment processing, Finix or another integrated payment provider, Zelle, Venmo, or another payment method approved by Ono-Fix.',
    'Payment availability may vary by job, Customer, Provider, location, and payment method.',
  ]},
  { title: '16. Zelle and Venmo', body: [
    'When Zelle or Venmo is selected as the payment method, the Customer should submit the final payment immediately after the agreed work has been completed, and the Service Provider should verify the payment before leaving the job site whenever reasonably possible.',
    'Because Ono-Fix may not receive direct real-time confirmation from Zelle or Venmo, the Platform may use separate payment statuses, including: Payment Requested, Payment Sent, Payment Verification, Payment Verified, Paid, and Payment Outstanding.',
    '"Payment Sent" does not automatically mean "Payment Verified." A Provider must not falsely report that a payment has been received.',
  ]},
  { title: '17. Completion of Work', body: [
    'When the Provider completes the agreed Scope of Work, the Provider may mark the job as completed. Ono-Fix may require the Provider to submit completion photographs, final labor time, materials used, the final amount, payment status, and completion notes.',
    'The Customer may review the completed work.',
  ]},
  { title: '18. Customer Confirmation', body: [
    'After the Provider marks a job completed, Ono-Fix may allow the Customer to CONFIRM COMPLETION or REPORT A PROBLEM.',
    'A Customer should report legitimate problems promptly and provide relevant information or photographs when requested. Customer confirmation does not waive any rights that cannot legally be waived.',
  ]},
  { title: '19. Payment After Completion', body: [
    'Unless a different payment schedule is specified, the remaining balance becomes due upon completion of the agreed Scope of Work.',
    'For Zelle or Venmo, the Customer should submit the final payment immediately after completion, and the Provider should verify payment before leaving the property whenever reasonably possible.',
    'If payment has not been verified, the job may remain: COMPLETED \u2014 PAYMENT OUTSTANDING.',
  ]},
  { title: '20. Customer Responsibilities', body: [
    'Customer agrees to:',
    { bullets: ['provide accurate information;', 'provide reasonable access to the property;', 'disclose known hazards;', 'secure pets when reasonably necessary;', 'communicate changes to requested work;', 'review Job Agreements and Change Orders;', 'pay amounts properly due;', 'not intentionally damage property or equipment;', 'treat Service Providers respectfully;', 'use the Platform honestly.'] },
  ]},
  { title: '21. Service Provider Responsibilities', body: [
    'Service Providers agree to:',
    { bullets: ['perform accepted work professionally;', 'arrive within the agreed scheduling window when reasonably possible;', 'communicate delays;', 'accurately record time;', 'accurately document materials;', 'communicate unexpected problems;', 'request approval for applicable additional work;', 'clean the immediate work area to the extent included in the Scope of Work;', 'follow applicable laws and codes;', 'maintain required licenses and insurance;', 'accurately report payment status.'] },
  ]},
  { title: '22. Property Access', body: [
    'Customer is responsible for providing reasonable access to the service location at the agreed time.',
    'If the Provider cannot access the property because of Customer-related circumstances, applicable cancellation, trip, minimum-service, or other charges may apply if disclosed in the applicable Job Agreement or Platform rules and permitted by law.',
    'Provider may refuse to enter a property when the Provider reasonably believes there is an unsafe condition.',
  ]},
  { title: '23. Safety', body: [
    'A Service Provider may stop work when reasonably necessary because of unsafe conditions, hazardous materials, exposed electrical hazards, structural instability, dangerous animals, threats or violence, illegal activity, or conditions outside the Provider\u2019s reasonable ability to safely address.',
    'The Provider should document the reason for stopping work through Ono-Fix when reasonably possible.',
  ]},
  { title: '24. Emergency Conditions', body: [
    'Ono-Fix is not an emergency response service unless expressly identified as such. Customers should contact appropriate emergency services when immediate danger to life, health, or property exists.',
    'Providers should not perform work outside their training, authorization, licensing, or ability to perform safely.',
  ]},
  { title: '25. Permits and Code Requirements', body: [
    'The Customer and Service Provider are responsible for complying with applicable permit and code requirements. The Service Provider should inform the Customer when the Provider reasonably believes that a permit or inspection may be required.',
    'Ono-Fix does not guarantee that a particular job does or does not require a permit.',
  ]},
  { title: '26. Photos and Job Information', body: [
    'Customers may upload photographs of the problem. Service Providers may upload inspection, progress, and completion photographs, material receipts, and other job documentation.',
    'Users represent that they have the right to provide material uploaded to the Platform. Users should not upload unnecessary sensitive personal information.',
  ]},
  { title: '27. Communications', body: [
    'Ono-Fix may facilitate communications between Customer and Provider, including in-app messages, email, SMS/text messages, notifications, and phone communications where enabled.',
    'Users agree not to use the Platform to send abusive, threatening, fraudulent, discriminatory, or unlawful communications.',
  ]},
  { title: '28. Off-Platform Transactions', body: [
    'Ono-Fix may provide communication and payment tools intended to facilitate transactions through the Platform.',
    'Users may not intentionally use information obtained through Ono-Fix to circumvent applicable Ono-Fix fees, commissions, or transaction requirements. This provision does not prohibit activities or rights that cannot legally be restricted.',
  ]},
  { title: '29. Ono-Fix Fees', body: [
    'Ono-Fix may charge Service Providers fees or commissions for transactions completed through the Platform. Applicable fees will be disclosed to the Provider through the Provider account, onboarding materials, applicable agreement, or Platform.',
    'Ono-Fix may update its fee structure subject to applicable agreements and law.',
  ]},
  { title: '30. Taxes', body: [
    'Customers and Service Providers are responsible for taxes applicable to their transactions. Service Providers are responsible for their own business, income, employment, sales, and other applicable tax obligations. Ono-Fix does not provide tax advice.',
  ]},
  { title: '31. Cancellation by Customer', body: [
    'A Customer may cancel a job according to the cancellation terms displayed by Ono-Fix or contained in the applicable Job Agreement.',
    'If a Provider has already traveled to the property, performed work, purchased authorized materials, or incurred another properly disclosed charge, the Customer may remain responsible for applicable amounts to the extent permitted by the agreement and law.',
  ]},
  { title: '32. Cancellation by Provider', body: [
    'A Provider may cancel or decline a job when reasonably necessary. Reasons may include unsafe conditions, incorrect job information, unavailable materials, licensing limitations, scheduling conflicts, conditions outside the Provider\u2019s reasonable ability to perform, Customer conduct, or other legitimate business reasons.',
    'The Provider should provide reasonable notice when possible.',
  ]},
  { title: '33. Illinois Home Repair Law', body: [
    'For Illinois home repair and remodeling transactions covered by the Illinois Home Repair and Remodeling Act, additional requirements may apply.',
    'For home-repair or remodeling work over $1,000, Illinois law requires a written contract or work order before work begins stating the total cost, including parts and materials listed with reasonable particularity and any estimate charge, and identifying the home-repair business by name and address.',
    'For contracts over $1,000, the Customer must receive the Illinois "Home Repair: Know Your Consumer Rights" pamphlet before execution of the contract. The Customer and contractor/representative must also complete the statutory Consumer Rights Acknowledgment requirements.',
    'For contracts of $1,000 or less, the pamphlet must still be provided, but Illinois law does not require a written acknowledgment of receipt.',
    'Ono-Fix may require additional job-specific documentation when required by applicable law. The Illinois Attorney General also advises consumers that contracts should identify the contractor, work, dates, total cost, payment schedule/method, and other important terms.',
  ]},
  { title: '34. Three-Day Cancellation Rights', body: [
    'Certain Illinois home-repair transactions may be subject to a statutory three-business-day cancellation right, particularly where the contract is made and signed at the consumer\u2019s residence.',
    'The right has statutory exceptions, including certain emergency situations and transactions initiated by the consumer. Where legally required, the applicable Job Agreement or contract will contain the required cancellation notice and documentation.',
    'Nothing in these Terms is intended to waive a statutory cancellation right that applies to a transaction. Illinois Attorney General guidance states that qualifying home-repair contracts signed at the consumer\u2019s home may carry a three-business-day cancellation right, subject to statutory exceptions.',
  ]},
  { title: '35. Consumer Rights', body: [
    'Nothing in these Terms is intended to:',
    { bullets: ['waive a consumer right that cannot legally be waived;', 'eliminate a statutory cancellation right;', 'eliminate legally required disclosures;', 'eliminate applicable warranty rights;', 'prevent a Customer from filing a lawful complaint;', 'prevent a Provider from exercising a lawful right.'] },
  ]},
  { title: '36. Disputes Between Customer and Provider', body: [
    'Customer and Provider should first attempt to resolve job-specific disputes through Ono-Fix. Ono-Fix may request the Job Agreement, Change Orders, photographs, messages, time records, material receipts, payment records, and completion records.',
    'Ono-Fix may facilitate communication between the parties. Ono-Fix does not guarantee a particular result in any dispute.',
  ]},
  { title: '37. Dispute Information', body: [
    'Users agree to provide truthful information when submitting a dispute. A user must not knowingly submit false evidence, altered photographs, false payment information, false labor records, false material receipts, or misleading statements.',
    'Submitting intentionally false information may result in suspension or termination of the account.',
  ]},
  { title: '38. Warranties and Workmanship', body: [
    'Any warranty provided by a Service Provider must be disclosed in the applicable Job Agreement or other written documentation.',
    'Ono-Fix does not automatically provide a warranty for work performed by an independent Service Provider unless Ono-Fix expressly states otherwise. A Service Provider remains responsible for warranties or guarantees that the Provider expressly provides.',
  ]},
  { title: '39. Customer Property', body: [
    'Service Providers must use reasonable care when working on Customer property. A Provider should immediately document through Ono-Fix any accidental damage that occurs during a job.',
    'Nothing in these Terms eliminates responsibility for damage caused by negligence, intentional misconduct, or other conduct for which liability cannot legally be excluded.',
  ]},
  { title: '40. Prohibited Conduct', body: [
    'Users may not:',
    { bullets: ['commit fraud;', 'steal;', 'threaten another person;', 'harass another user;', 'falsify information;', 'falsify hours;', 'falsify materials;', 'falsify payment status;', 'intentionally damage property;', "use another person's account;", 'upload malicious software;', 'interfere with Platform operation;', 'attempt unauthorized access;', 'circumvent Platform security;', 'use the Platform for unlawful purposes.'] },
  ]},
  { title: '41. Account Suspension and Termination', body: [
    'Ono-Fix may suspend, restrict, or terminate an account when reasonably necessary because of violation of these Terms, fraudulent activity, repeated payment disputes, unsafe conduct, abusive conduct, false information, unauthorized access, illegal activity, or repeated failure to comply with Platform rules.',
    'Where appropriate, Ono-Fix may provide notice and an opportunity to resolve the issue. Nothing in this section limits rights required by applicable law.',
  ]},
  { title: '42. Platform Availability', body: [
    'Ono-Fix attempts to keep the Platform available but does not guarantee uninterrupted operation.',
    'The Platform may temporarily be unavailable because of maintenance, technical problems, Internet outages, third-party services, payment processor problems, security incidents, or circumstances beyond Ono-Fix\u2019s reasonable control.',
  ]},
  { title: '43. Third-Party Services', body: [
    'Ono-Fix may use third-party services for payments, identity verification, communications, maps, hosting, analytics, authentication, and fraud prevention.',
    'Third-party services may have their own terms and privacy policies.',
  ]},
  { title: '44. Payments and Third-Party Processors', body: [
    'When a Customer uses an integrated payment method, the payment may be processed by a third-party payment provider.',
    'Ono-Fix may not control payment processor approval, bank processing times, payment reversals, account holds, third-party verification, or payment processor disputes. Users agree to provide accurate information required for payment processing.',
  ]},
  { title: '45. Refunds', body: [
    'Refunds, credits, or payment adjustments may be handled according to the applicable Job Agreement, Platform policies, payment processor rules, and applicable law.',
    'Ono-Fix does not guarantee a refund unless the Customer is entitled to one under the applicable agreement or law.',
  ]},
  { title: '46. Intellectual Property', body: [
    'The Ono-Fix Platform, including its software, design, branding, logos, text, graphics, and other original content, belongs to Ono-Fix or its licensors unless otherwise stated.',
    'Users may not copy, modify, distribute, sell, reverse engineer, or commercially exploit Ono-Fix intellectual property without authorization.',
  ]},
  { title: '47. User Content', body: [
    'Users retain ownership of content they upload, subject to the rights necessary for Ono-Fix to operate the Platform.',
    'By uploading photographs, descriptions, reviews, or other content, the user grants Ono-Fix a non-exclusive, worldwide, royalty-free license to store, process, display, and use that content as reasonably necessary to operate, improve, secure, and provide the Platform.',
    'Ono-Fix will handle personal information according to its Privacy Policy.',
  ]},
  { title: '48. Reviews and Ratings', body: [
    'Customers and Providers may be permitted to leave ratings or reviews. Reviews must be truthful, based on actual experience, relevant, non-threatening, and non-fraudulent.',
    'Users may not manipulate ratings or create fake reviews. Ono-Fix may remove content that violates Platform rules or applicable law.',
  ]},
  { title: '48A. Loyalty, Rewards & Provider Ranking', body: [
    'Ono-Fix may operate optional loyalty and referral programs. Customers may earn loyalty points on paid orders that can be redeemed for gift cards; a referred Customer who completes qualifying paid orders may earn the referrer a one-time points bonus. Points have no cash value, are non-transferable, and may be adjusted or reversed if the underlying order is refunded or cancelled.',
    'Providers are ranked within each service category based on worked hours, review ratings, and bonus/adjustment hours (including referral bonuses when a Provider a Provider referred completes their first paid job). Ranking is informational, updates automatically, may change at any time, and does not guarantee any Provider a booking. Ono-Fix may add, remove, modify, suspend, or discontinue any rewards, referral, or ranking program and may adjust point values, bonus amounts, and ranking hours at any time at its discretion.',
  ]},
  { title: '49. Artificial Intelligence', body: [
    'Ono-Fix may use artificial intelligence to analyze photographs, identify potential problems, estimate possible work, suggest service categories, or assist with matching Customers and Providers.',
    'AI-generated information is informational and may not be accurate. AI suggestions do not replace professional inspection, licensed professional judgment, permits, building codes, or safety requirements.',
    'The Service Provider remains responsible for determining the appropriate work to perform. The Customer should not rely solely on an AI-generated estimate when making safety-critical or legally significant decisions.',
  ]},
  { title: '50. Limitation of Platform Responsibility', body: [
    'To the maximum extent permitted by law, Ono-Fix is not responsible for the independent acts or omissions of Service Providers or Customers.',
    'Ono-Fix does not guarantee that a Provider will accept a job, will arrive at a particular time, that a repair will solve a problem, that an estimate will be accurate, that a particular material will be available, that a Customer will pay, that a Provider will complete a job, or that a third-party payment will succeed.',
    'However, nothing in these Terms excludes liability that cannot legally be excluded.',
  ]},
  { title: '51. Limitation of Liability', body: [
    'To the maximum extent permitted by applicable law, Ono-Fix shall not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages arising from use of the Platform.',
    'Any limitation of liability is subject to applicable law and does not apply to liability that cannot legally be limited or excluded.',
  ]},
  { title: '52. Indemnification', body: [
    'To the extent permitted by law, users agree to defend, indemnify, and hold harmless Ono-Fix, Nexus Security Solutions LLC, and their officers, employees, agents, and contractors from claims, damages, liabilities, costs, and expenses arising from:',
    { bullets: ["the user's violation of these Terms;", 'unlawful conduct;', 'fraud;', 'intentional misconduct;', 'unauthorized use of the Platform;', "violation of another person's rights;", 'work performed by a Service Provider, to the extent attributable to that Provider.'] },
    'This provision does not require indemnification to the extent prohibited by law.',
  ]},
  { title: '53. Electronic Agreements and Records', body: [
    'Users agree that electronic acceptance may be used to document agreements through Ono-Fix.',
    'When a user selects "I AGREE" or another equivalent electronic acceptance mechanism, Ono-Fix may record the user, role, agreement version, date, time, acceptance status, applicable transaction, and other technical information reasonably necessary to maintain the record.',
    'Ono-Fix may retain previous versions of Terms and transaction agreements.',
  ]},
  { title: '54. Job Agreement Acceptance', body: [
    'Acceptance of these Terms does not automatically mean that a Customer has accepted a particular job. A separate Job Agreement may require additional acceptance.',
    'Similarly, a Service Provider\u2019s acceptance of these Terms does not automatically mean the Provider has accepted every job offered through the Platform. Each job may require separate acceptance by the Customer and Service Provider.',
  ]},
  { title: '55. Record Retention', body: [
    'Ono-Fix may retain transaction records for a reasonable period, including Terms acceptance, Job Agreements, Change Orders, messages, photographs, payment records, completion records, and dispute records.',
    'Records may be retained longer when necessary for legal, accounting, security, fraud-prevention, or regulatory purposes.',
  ]},
  { title: '56. Privacy', body: [
    'Use of the Platform is also governed by the Ono-Fix Privacy Policy. The Privacy Policy explains how Ono-Fix collects, uses, stores, and protects personal information.',
  ]},
  { title: '57. Changes to Terms', body: [
    'Ono-Fix may update these Terms from time to time. When material changes are made, Ono-Fix may provide notice through email, Platform notification, account notification, or other reasonable communication.',
    'The updated Terms will state the effective date. Where required, Ono-Fix may require the user to affirmatively accept updated Terms before continuing to use certain Platform functions.',
  ]},
  { title: '58. Governing Law', body: [
    'These Terms shall be governed by applicable law. For transactions governed by Illinois law, Illinois law shall apply to the extent permitted by law.',
    'Nothing in these Terms is intended to deprive a consumer of mandatory protections provided by the law applicable to the transaction.',
  ]},
  { title: '59. Severability', body: [
    'If any provision of these Terms is determined to be invalid or unenforceable, the remaining provisions will remain in effect to the extent permitted by law.',
  ]},
  { title: '60. Entire Agreement', body: [
    'These Terms, together with the Privacy Policy, applicable Job Agreement, Change Orders, and other applicable Platform agreements, constitute the applicable agreement governing the user\u2019s use of Ono-Fix.',
    'If there is a conflict: (1) applicable mandatory law controls; (2) a job-specific agreement controls the specific terms of that job; (3) these Terms control general Platform use; (4) the Privacy Policy controls privacy matters.',
  ]},
  { title: '61. No Waiver', body: [
    'Failure by Ono-Fix to enforce a provision of these Terms does not constitute a waiver of the right to enforce that provision later.',
  ]},
  { title: '62. Notices', body: [
    'Ono-Fix may provide notices through email, SMS, in-app notifications, account notifications, or other electronic means associated with the user\u2019s account.',
    'Users are responsible for maintaining accurate contact information.',
  ]},
  { title: '63. Customer and Provider Acknowledgment', body: [
    'By using Ono-Fix, the user acknowledges that:',
    { bullets: ['Ono-Fix is a technology platform;', 'Service Providers may be independent businesses;', 'individual jobs may be governed by separate Job Agreements;', 'hourly jobs may have an unknown final number of hours;', 'materials may not be known before inspection;', 'additional work may require a Change Order;', 'payment is required for amounts properly due;', 'Zelle/Venmo payments may require Provider verification;', 'applicable laws may require additional documents;', 'the user should review the applicable Job Agreement before accepting a job.'] },
  ]},
  { title: '64. Electronic Acceptance', body: [
    'Customer \u2014 By checking the acceptance box in the app: "I have read and agree to the Ono-Fix Terms of Use." Ono-Fix records the Customer name, email, date, time, Terms version, and acceptance record ID.',
    'Service Provider \u2014 By checking the acceptance box in the app: "I have read and agree to the Ono-Fix Terms of Use." Ono-Fix records the Provider name, business name, email, date, time, Terms version, and acceptance record ID.',
  ]},
  { title: '65. Important Notice', body: [
    'These Terms of Use establish the general rules for using Ono-Fix. They do not replace a Job Agreement / Work Order when a separate written agreement is required for a particular service or under applicable law.',
    'For Illinois home repair or remodeling transactions, Ono-Fix will provide additional job-specific documentation when required by Illinois law.',
  ]},
  { title: '66. Independent Contractor Status & Limitation of Liability (Addendum)', body: [
    '66.1 Third-Party Service Provider Relationship. Ono-Fix operates exclusively as a technology marketplace platform connecting independent contractors ("Service Providers") with users seeking handyman, maintenance, and technical services ("Clients"). Ono-Fix is not an employer, joint venturer, partner, or agent of any Service Provider. Service Providers act solely as independent contractors using their own tools, skills, and judgment.',
    '66.2 Non-Party Status in Disputes. Ono-Fix is strictly not a party to any contract, agreement, or transaction entered into between a Client and a Service Provider. Ono-Fix assumes no responsibility, duty, or liability for:',
    { bullets: [
      'the quality, safety, legality, timeliness, or adequacy of any services performed by a Service Provider;',
      'any personal injury, property loss, or material damage caused directly or indirectly by a Service Provider;',
      'any misrepresentation, breach of agreement, or failure to complete requested work by a Service Provider.',
    ]},
    '66.3 Dispute Mediation Assistance. All disputes regarding service quality, incomplete work, property damage, or pricing must be resolved directly between the Client and the Service Provider. Ono-Fix may, at its sole discretion, offer automated or representative assistance to facilitate communication between the parties, but such assistance does not constitute an assumption of legal liability or obligation by Ono-Fix.',
    'Nothing in this Section excludes or limits any liability that cannot lawfully be excluded or limited under applicable law.',
  ]},
  { title: '67. Chargeback Indemnification, Fund Retention & Set-Off Rights', body: [
    '67.1 Chargeback and Reversal Responsibility. Each Service Provider accepts full financial responsibility for all payment chargebacks, credit card disputes, unauthorized transactions, or ACH reversals initiated by Clients relating to services offered or billed by such Service Provider through the Platform.',
    '67.2 Right of Set-Off & Direct Recovery. If a Client initiates a chargeback, refund request, or payment reversal, or if Finix Payments, Inc. (or any successor payment processor) debits funds from Ono-Fix or Nexus Security Solutions LLC corresponding to a Service Provider\u2019s transaction, Ono-Fix reserves the immediate right to:',
    { bullets: [
      'deduct the full chargeback amount plus any applicable administrative dispute fees ($30.00+ per occurrence) from the Service Provider\u2019s pending or future payouts;',
      'debit the Service Provider\u2019s designated bank account via ACH for any outstanding negative balance;',
      'withhold payouts or impose a temporary hold (Rolling Reserve) on the Service Provider\u2019s account funds for up to 120 calendar days to cover potential chargebacks or dispute exposures.',
    ]},
    '67.3 Duty to Provide Dispute Documentation. Service Providers agree to maintain and promptly supply Ono-Fix with clear proof of service completion (including signed work completion receipts, before-and-after photographic evidence, timestamped location logs, and written client approvals) within 48 hours of a dispute notice.',
  ]},
  { title: '68. Account Suspension, Termination & Platform Modifications (Addendum)', body: [
    '68.1 Right to Suspend or Terminate. Ono-Fix reserves the right, at its sole and absolute discretion, to suspend, limit, restrict, or permanently terminate the account and access privileges of any user (Client or Service Provider) at any time, for any reason or no reason, with or without prior notice or explanation, subject to any protections required by applicable law.',
    '68.2 Immediate Termination Triggers. Without limiting the generality of Section 68.1, immediate termination without prior warning may occur if a user:',
    { bullets: [
      'violates these Terms of Service or applicable law;',
      'exhibits excessive chargeback rates, fraud risk, or payment disputes;',
      'engages in abusive, unprofessional, or harmful conduct toward Clients, Service Providers, or Platform staff;',
      'fails to supply required verification documentation (KYC/AML checks).',
    ]},
  ]},
  { title: '69. Payment Restrictions & 24-Hour Advance Charge Limit', body: [
    '69.1 Prohibition of Advance Billing. Service Providers are strictly prohibited from collecting payment or authorizing credit card charges more than twenty-four (24) hours prior to the actual physical commencement or delivery of the requested services, unless explicitly authorized in advance under a separate written agreement approved by Ono-Fix and its processing partners.',
  ]},
  { title: '70. Summary of Protective Provisions', body: [
    'The following summary is provided for convenience only and does not modify, expand, or limit the provisions above:',
    { bullets: [
      'Non-Party Clause (Section 66.2): establishes Ono-Fix purely as a technology mediator; addresses property-damage and workmanship claims.',
      'Set-Off Rights (Section 67.2): allows direct deduction of chargebacks from payouts; addresses payment-processor sub-merchant liability.',
      'Dispute Proof (Section 67.3): requires photo and signature documentation from field technicians to support chargeback responses.',
      'Discretionary Termination (Section 68.1): allows removal of high-risk users to limit payment-processor reserve exposure.',
    ]},
  ]},
  { title: '71. Daily Work Confirmations and Progress Payments', body: [
    'Where the Services are performed over multiple work periods, the Customer may be presented with a Daily Work Confirmation describing the Services performed during a particular work period and the corresponding amount due.',
    'Each Daily Work Confirmation identifies the specific Services performed, the applicable date, the service provider or technician, and the amount due for that work period.',
    'By electronically accepting a Daily Work Confirmation and authorizing payment, the Customer acknowledges that the Services identified in that Daily Work Confirmation were performed during the applicable work period and authorizes payment of the stated amount.',
    'Each Daily Work Confirmation constitutes a record of the applicable Services performed and payment authorized for that work period and is incorporated into and governed by the Customer Agreement.',
    'Acceptance of a Daily Work Confirmation applies only to the Services specifically described in that Daily Work Confirmation and does not constitute acceptance of Services that have not yet been performed.',
    'The Customer will receive or have access to a copy of each Daily Work Confirmation and payment receipt.',
  ]},
];

export default function TermsOfUse() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Terms of Use — Ono-Fix</title>
        <meta name="description" content="Ono-Fix Terms of Use — the service agreement governing use of the Ono-Fix home services platform, operated by Nexus Security Solutions LLC." />
        <link rel="canonical" href="https://ono-fix.com/terms" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Use</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="terms-screen">
        <Text style={styles.docTitle}>Ono-Fix Terms of Use</Text>
        <Text style={styles.meta}>Effective Date: {EFFECTIVE_DATE} · Last Updated: {LAST_UPDATED}</Text>

        <Text style={styles.p}>
          These Terms of Use ("Terms") govern access to and use of the Ono-Fix platform, website, mobile applications, and related services (collectively, the "Platform"). Ono-Fix is operated by <Text style={styles.bold}>Nexus Security Solutions LLC</Text>, an Illinois limited liability company ("Ono-Fix," "we," "us," or "our").
        </Text>
        <Text style={styles.p}>
          These Terms apply to all users of the Platform, including customers ("Customers") and service providers ("Service Providers" or "Providers"). By creating an account, accessing the Platform, requesting a service, accepting a job, providing services through the Platform, or otherwise using the Platform, you agree to these Terms. If you do not agree to these Terms, you may not use the Platform.
        </Text>

        {SECTIONS.map((sec) => (
          <View key={sec.title}>
            <Text style={styles.h2}>{sec.title}</Text>
            {sec.body.map((para, i) =>
              typeof para === 'string' ? (
                <Text key={i} style={styles.p}>{para}</Text>
              ) : (
                <View key={i} style={styles.bullets}>
                  {para.bullets.map((b, j) => (
                    <View key={j} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              )
            )}
          </View>
        ))}

        <View style={styles.footerBox}>
          <Text style={styles.bold}>ONO-FIX</Text>
          <Text style={styles.footerText}>Operated by Nexus Security Solutions LLC</Text>
          <Text style={styles.footerText}>9701 Dee Rd, Niles, IL 60714</Text>
          <Text style={styles.footerText}>Contact: <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text></Text>
          <Text style={styles.footerText}>Effective Date: {EFFECTIVE_DATE} · Last Updated: {LAST_UPDATED}</Text>
          <Text style={styles.footerText}>Terms Version: 2026-06-15</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20 },
  docTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  meta: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 18, marginBottom: 8 },
  p: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
  bold: { fontWeight: '700', color: '#111827' },
  link: { color: '#2563eb', textDecorationLine: 'underline' },
  bullets: { marginBottom: 8, paddingLeft: 4 },
  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { fontSize: 14, color: '#6b7280', width: 16, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 22 },
  footerBox: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 3 },
  footerText: { fontSize: 13, color: '#6b7280' },
});
