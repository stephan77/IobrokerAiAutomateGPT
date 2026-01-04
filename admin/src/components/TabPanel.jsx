import Box from "@mui/material/Box";

const TabPanel = ({ children, value, index }) => {
  if (value !== index) {
    return null;
  }

  return <Box className="tab-content">{children}</Box>;
};

export default TabPanel;
