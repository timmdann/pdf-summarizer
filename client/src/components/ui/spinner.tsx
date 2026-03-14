function Spinner() {
  return (
    <div className="flex items-center justify-center" role="status" aria-label="Loading">
      <div className="mt-20 w-10 h-10 border-4 border-t-teal-500 border-gray-300 rounded-full animate-spin" />
    </div>
  );
}

export default Spinner;
