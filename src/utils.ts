export const getClientDate = (dateString: string) => {
  const clientDate = new Date(dateString);
  if (isNaN(clientDate.getTime())) {
    return null;
  }
  return clientDate;
};

export const getClientDateString = (dateString: string) => {
  const clientDate = getClientDate(dateString);
  if (!clientDate) {
    return null;
  }

  return clientDate.toISOString().split("T")[0];
};

export const compareDates = (date1: string, date2: string) => {
  return getClientDateString(date1) === getClientDateString(date2);
};




