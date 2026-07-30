function Page_transition({ page_key, direction, children }) {
  return (
    <div
      key={page_key}
      className={`page-transition page-transition--${direction}`}
    >
      {children}
    </div>
  );
}

export default Page_transition;
