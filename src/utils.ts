export const getClientDateString = (dateString: string) => {
  const clientDate = new Date(dateString);
  if (isNaN(clientDate.getTime())) {
    return null;
  }

  return clientDate.toISOString().split("T")[0];
};
