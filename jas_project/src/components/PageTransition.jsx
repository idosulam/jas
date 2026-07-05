function PageTransition({ pageKey, direction, children }) {
  return (
    <div
      key={pageKey}
      className={`page-transition page-transition--${direction}`}
    >
      {children}
    </div>
  );
}

export default PageTransition;
