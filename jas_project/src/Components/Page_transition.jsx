function PageTransition({ page_key, direction, children }) {
  return (
    <div
      key={page_key}
      className={`page-transition page-transition--${direction}`}
    >
      {children}
    </div>
  );
}

export default PageTransition;
