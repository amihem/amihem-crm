import { newId } from "../utils/helpers";

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const daysAhead = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function buildSeed() {
  const customers = [
    {
      id: newId(),
      name: "Vardhman Garments",
      company: "Vardhman Garments Pvt Ltd",
      city: "Ludhiana",
      state: "Punjab",
      country: "India",
      buyerName: "Rakesh Mehta",
      phone: "9876543210",
      whatsapp: "9876543210",
      email: "rakesh@vardhman.example",
      category: "Manufacturer",
      status: "Active",
      preferredFabric: "Cotton Lycra",
      creditDays: 30,
      remarks: "Regular buyer, prefers dark shades",
    },
    {
      id: newId(),
      name: "Silverline Exports",
      company: "Silverline Exports",
      city: "Tirupur",
      state: "Tamil Nadu",
      country: "India",
      buyerName: "Priya Rangan",
      phone: "9123456780",
      whatsapp: "9123456780",
      email: "priya@silverline.example",
      category: "Exporter",
      status: "Potential",
      preferredFabric: "RFD",
      creditDays: 45,
      remarks: "New enquiry via trade fair",
    },
    {
      id: newId(),
      name: "Meher Boutique",
      company: "Meher Studio",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      buyerName: "Sanya Meher",
      phone: "9988776655",
      whatsapp: "9988776655",
      email: "sanya@meher.example",
      category: "Boutique",
      status: "Active",
      preferredFabric: "Dobby",
      creditDays: 15,
      remarks: "",
    },
  ];

  const products = [
    {
      id: newId(),
      category: "Cotton Lycra",
      subCategory: "Stretch",
      qualityName: "CL-220 Twill",
      construction: "2/1 Twill",
      composition: "97% Cotton 3% Lycra",
      gsm: "220",
      width: "58",
      millName: "Om Textiles",
      colour: "Assorted",
      moq: "500m",
      price: "185",
    },
    {
      id: newId(),
      category: "RFD",
      subCategory: "Plain",
      qualityName: "RFD Poplin 120",
      construction: "Plain",
      composition: "100% Cotton",
      gsm: "120",
      width: "44",
      millName: "Ganga Mills",
      colour: "White",
      moq: "1000m",
      price: "92",
    },
    {
      id: newId(),
      category: "Dobby",
      subCategory: "Structured",
      qualityName: "Dobby Check DC-14",
      construction: "Dobby",
      composition: "100% Cotton",
      gsm: "160",
      width: "58",
      millName: "Shree Textiles",
      colour: "Multi",
      moq: "300m",
      price: "142",
    },
  ];

  const tickets = [
    {
      id: newId(),
      ticketNumber: `AMH-${new Date().getFullYear()}-0001`,
      date: daysAgo(12),
      customerId: customers[0].id,
      productId: products[0].id,
      shade: "Navy",
      quantity: "5",
      unit: "meters",
      sampleType: "Cutting",
      dispatchMode: "Courier",
      courierName: "Delhivery",
      trackingNumber: "DL392001",
      dispatchDate: daysAgo(11),
      expectedDelivery: daysAgo(9),
      received: true,
      garmentDeveloped: true,
      stage: "Price Discussion",
      remarks: "Liked the hand feel, negotiating price",
    },
    {
      id: newId(),
      ticketNumber: `AMH-${new Date().getFullYear()}-0002`,
      date: daysAgo(20),
      customerId: customers[1].id,
      productId: products[1].id,
      shade: "White",
      quantity: "3",
      unit: "meters",
      sampleType: "1 Pc",
      dispatchMode: "Courier",
      courierName: "Bluedart",
      trackingNumber: "BD772110",
      dispatchDate: daysAgo(19),
      expectedDelivery: daysAgo(16),
      received: true,
      garmentDeveloped: false,
      stage: "Testing",
      remarks: "Awaiting shrinkage test result",
    },
    {
      id: newId(),
      ticketNumber: `AMH-${new Date().getFullYear()}-0003`,
      date: daysAgo(5),
      customerId: customers[2].id,
      productId: products[2].id,
      shade: "Multi Check",
      quantity: "2",
      unit: "meters",
      sampleType: "Hanger",
      dispatchMode: "Hand Delivered",
      received: true,
      garmentDeveloped: false,
      stage: "Sample Sent",
      remarks: "",
    },
  ];

  const followups = [
    {
      id: newId(),
      ticketId: tickets[0].id,
      date: daysAgo(2),
      time: "11:30",
      mode: "Phone",
      discussion: "Discussed pricing, buyer wants 5% reduction",
      nextFollowUpDate: daysAhead(-1), // overdue
      priority: "High",
      status: "Price High",
    },
    {
      id: newId(),
      ticketId: tickets[1].id,
      date: daysAgo(4),
      time: "16:00",
      mode: "WhatsApp",
      discussion: "Buyer confirmed sample received, testing in process",
      nextFollowUpDate: daysAhead(0), // today
      priority: "Medium",
      status: "Waiting",
    },
    {
      id: newId(),
      ticketId: tickets[2].id,
      date: daysAgo(1),
      time: "10:00",
      mode: "Meeting",
      discussion: "Showed hanger, buyer liked check pattern",
      nextFollowUpDate: daysAhead(3),
      priority: "Medium",
      status: "Interested",
    },
  ];

  return { customers, products, tickets, followups };
}
