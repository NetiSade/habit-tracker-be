export const getClientDateString = (dateString: string) => {
  const clientDate = new Date(dateString);
  if (isNaN(clientDate.getTime())) {
    return null;
  }

  return clientDate.toISOString().split("T")[0];
};

export const generateDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};
